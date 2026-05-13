import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BRIDGE = ROOT / "projects/macos-gui-openai-bridge/src/bridge.py"
KITS = ROOT / "projects/macos-gui-openai-bridge/kits"


class BridgeCliTests(unittest.TestCase):
    def run_cmd(self, *args: str):
        return subprocess.run(["python3", str(BRIDGE), *args], capture_output=True, text=True)

    def test_validate_examples(self):
        for kind, file_name in [
            ("agent", "agent-kit.example.json"),
            ("thread", "chat-thread-kit.example.json"),
            ("widget", "widget-kit.example.json"),
            ("check", "check-kit.example.json"),
        ]:
            proc = self.run_cmd("validate", "--kind", kind, "--file", str(KITS / file_name))
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertIn("Validation successful", proc.stdout)

    def test_rejects_missing_file(self):
        proc = self.run_cmd("validate", "--kind", "agent", "--file", str(KITS / "does-not-exist.json"))
        self.assertEqual(proc.returncode, 1)
        self.assertIn("File not found", proc.stderr)

    def test_rejects_non_dict_metadata(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "bad-agent.json"
            path.write_text(
                json.dumps(
                    {
                        "name": "bad",
                        "model": "gpt-5",
                        "instructions": "x",
                        "metadata": ["not", "object"],
                    }
                ),
                encoding="utf-8",
            )
            env = dict(**__import__("os").environ, OPENAI_API_KEY="test")
            proc = subprocess.run(
                ["python3", str(BRIDGE), "push-agent", "--file", str(path), "--output-format", "json"],
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(proc.returncode, 1)
            self.assertIn("metadata must be an object", proc.stderr)


if __name__ == "__main__":
    unittest.main()
