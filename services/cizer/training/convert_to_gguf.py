# /// script
# dependencies = ["transformers", "peft", "torch", "accelerate", "huggingface_hub", "gguf", "numpy", "sentencepiece", "protobuf"]
# ///
"""
Convert Cizer SFT LoRA adapter to GGUF format for Ollama/llama.cpp deployment.

Merges the LoRA adapter with the base model, then converts to GGUF with Q4_K_M quantization.

Usage (via HF Jobs):
    hf_jobs("uv", {
        "script": "<this script content>",
        "flavor": "a10g-large",
        "timeout": "45m",
        "secrets": {"HF_TOKEN": "$HF_TOKEN"},
        "env": {
            "ADAPTER_MODEL": "caesarniseko/cizer-v1-sft",
            "BASE_MODEL": "Qwen/Qwen2.5-7B-Instruct",
            "OUTPUT_REPO": "caesarniseko/cizer-v1-gguf"
        }
    })
"""

import os
import subprocess
import sys
from pathlib import Path

from huggingface_hub import HfApi, snapshot_download
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

# Configuration
ADAPTER_MODEL = os.environ.get("ADAPTER_MODEL", "caesarniseko/cizer-v1-sft")
BASE_MODEL = os.environ.get("BASE_MODEL", "Qwen/Qwen2.5-7B-Instruct")
OUTPUT_REPO = os.environ.get("OUTPUT_REPO", "caesarniseko/cizer-v1-gguf")
QUANT_TYPE = os.environ.get("QUANT_TYPE", "q4_k_m")

print(f"=== Cizer GGUF Conversion ===")
print(f"Adapter: {ADAPTER_MODEL}")
print(f"Base: {BASE_MODEL}")
print(f"Output: {OUTPUT_REPO}")
print(f"Quantization: {QUANT_TYPE}")

# Step 1: Load and merge LoRA adapter
print("\n[1/4] Loading base model...")
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype="auto",
    device_map="auto",
    trust_remote_code=True,
)
tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)

print("[2/4] Merging LoRA adapter...")
model = PeftModel.from_pretrained(base_model, ADAPTER_MODEL)
merged_model = model.merge_and_unload()

# Save merged model
merged_path = Path("/tmp/cizer-merged")
merged_path.mkdir(parents=True, exist_ok=True)
merged_model.save_pretrained(str(merged_path))
tokenizer.save_pretrained(str(merged_path))
print(f"Merged model saved to {merged_path}")

# Step 2: Install llama.cpp conversion tools
print("[3/4] Setting up llama.cpp converter...")
llama_cpp_path = Path("/tmp/llama.cpp")
if not llama_cpp_path.exists():
    subprocess.run(
        ["git", "clone", "--depth=1", "https://github.com/ggerganov/llama.cpp.git", str(llama_cpp_path)],
        check=True,
    )
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", str(llama_cpp_path / "requirements.txt")],
        check=True,
    )

# Step 3: Convert to GGUF
print("[4/4] Converting to GGUF...")
gguf_output = Path("/tmp/cizer-gguf")
gguf_output.mkdir(parents=True, exist_ok=True)
gguf_file = gguf_output / f"cizer-v1-{QUANT_TYPE}.gguf"

# Convert HF format to GGUF
subprocess.run(
    [
        sys.executable,
        str(llama_cpp_path / "convert_hf_to_gguf.py"),
        str(merged_path),
        "--outtype", QUANT_TYPE,
        "--outfile", str(gguf_file),
    ],
    check=True,
)

print(f"GGUF file created: {gguf_file} ({gguf_file.stat().st_size / 1e9:.2f} GB)")

# Step 4: Upload to Hub
print("Uploading to Hub...")
api = HfApi()
api.create_repo(OUTPUT_REPO, repo_type="model", private=True, exist_ok=True)
api.upload_file(
    path_or_fileobj=str(gguf_file),
    path_in_repo=gguf_file.name,
    repo_id=OUTPUT_REPO,
    repo_type="model",
)

# Create model card
model_card = f"""---
license: apache-2.0
base_model: {BASE_MODEL}
tags:
  - gguf
  - niseko-gazet
  - cizer
  - editorial-ai
quantized_by: cizer-pipeline
---

# Cizer v1 GGUF - Niseko Gazet AI Editor

GGUF quantized version of the Cizer editorial AI model for local deployment with Ollama or llama.cpp.

## Usage with Ollama

```bash
# Create Modelfile
cat > Modelfile <<'EOF'
FROM ./cizer-v1-{QUANT_TYPE}.gguf
SYSTEM "You are Cizer, the AI Editor-in-Chief of Niseko Gazet. Transform raw field notes into structured news articles. NEVER fabricate facts."
PARAMETER temperature 0.3
PARAMETER top_p 0.9
EOF

# Create and run
ollama create cizer -f Modelfile
ollama run cizer
```

## Training Details
- Base model: `{BASE_MODEL}`
- Fine-tuned with: LoRA (r=16, alpha=32)
- Dataset: `{ADAPTER_MODEL.replace('-sft', '-editorial-data')}`
- Quantization: `{QUANT_TYPE}`
"""

api.upload_file(
    path_or_fileobj=model_card.encode(),
    path_in_repo="README.md",
    repo_id=OUTPUT_REPO,
    repo_type="model",
)

print(f"\nModel uploaded to: https://huggingface.co/{OUTPUT_REPO}")
print("=== GGUF Conversion Complete ===")
