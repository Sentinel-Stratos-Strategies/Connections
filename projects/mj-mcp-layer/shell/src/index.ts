import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import logger from './logger.js';
import { validateOrigin, validateToken, User } from './auth.js';
import { parseInboundMessage, formatOutboundMessage, InboundMessage } from './protocol.js';
import { Session } from './session.js';

const PORT = parseInt(process.env.PORT || '8080');
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS || '10');

const server = createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200);
    res.end('OK');
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

const rateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60,
});

const activeSessions = new Map<WebSocket, Session>();

server.on('upgrade', (request, socket, head) => {
  const origin = request.headers.origin;
  if (!validateOrigin(origin)) {
    logger.warn({ origin }, 'Origin rejected');
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  if (activeSessions.size >= MAX_SESSIONS) {
    logger.warn('Max sessions reached');
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws, request) => {
  const ip = request.socket.remoteAddress || 'unknown';
  let user: User | null = null;
  let session: Session | null = null;
  let authAttempts = 0;

  logger.info({ ip }, 'New connection');

  ws.on('message', async (data) => {
    try {
      const msg = parseInboundMessage(data.toString());

      if (!user) {
        if (msg.type !== 'auth') {
          ws.send(formatOutboundMessage({ type: 'auth_fail', reason: 'Authentication required' }));
          return;
        }

        try {
          await rateLimiter.consume(ip);
        } catch (err) {
          ws.send(formatOutboundMessage({ type: 'auth_fail', reason: 'Too many authentication attempts' }));
          return;
        }

        const validatedUser = await validateToken(msg.token);
        if (validatedUser) {
          user = validatedUser;
          ws.send(formatOutboundMessage({ type: 'auth_ok', user }));
          
          session = new Session(
            user,
            msg.token,
            (output) => {
              ws.send(formatOutboundMessage({ type: 'output', data: output }));
            },
            (code) => {
              ws.send(formatOutboundMessage({ type: 'exit', code }));
              ws.close();
            }
          );

          session.onConfirmRequired = (command, phrase) => {
            ws.send(formatOutboundMessage({ type: 'confirm_required', command, phrase }));
          };

          activeSessions.set(ws, session);
          logger.info({ userId: user.userId, ip }, 'User authenticated');
        } else {
          authAttempts++;
          ws.send(formatOutboundMessage({ type: 'auth_fail', reason: 'Invalid token' }));
          if (authAttempts >= 3) {
            ws.close();
          }
        }
        return;
      }

      // If already authenticated, handle commands
      if (session) {
        switch (msg.type) {
          case 'command':
            session.handleCommand(msg.payload);
            break;
          case 'resize':
            session.handleResize(msg.cols, msg.rows);
            break;
          case 'signal':
            session.handleSignal(msg.signal);
            break;
          case 'confirm':
            session.handleConfirm(msg.phrase);
            break;
          default:
            ws.send(formatOutboundMessage({ type: 'error', message: 'Unknown message type for active session' }));
        }
      }

    } catch (err) {
      logger.error({ err }, 'Message processing error');
      ws.send(formatOutboundMessage({ type: 'error', message: 'Malformed message' }));
    }
  });

  ws.on('close', () => {
    if (session) {
      session.destroy();
      activeSessions.delete(ws);
    }
    logger.info({ ip }, 'Connection closed');
  });
});

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'MJ Brady Shell service listening');
});
