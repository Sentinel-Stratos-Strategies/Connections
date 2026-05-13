FROM python:3.12-slim
WORKDIR /app
COPY . /app
EXPOSE 8080
ENV MJ_DB_PATH=/data/mj_edge.db
VOLUME ["/data"]
CMD ["python3", "server.py"]
