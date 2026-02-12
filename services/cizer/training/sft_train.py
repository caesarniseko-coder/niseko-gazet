# /// script
# dependencies = ["trl>=0.12.0", "peft>=0.7.0", "trackio", "datasets", "transformers", "torch", "accelerate"]
# ///
"""
Cizer SFT Training Script
Fine-tunes Qwen/Qwen2.5-7B-Instruct on Niseko Gazet editorial data
for the Cizer AI Editor-in-Chief pipeline.

Usage (via HF Jobs):
    hf_jobs("uv", {
        "script": "<this script content>",
        "flavor": "a10g-large",
        "timeout": "3h",
        "secrets": {"HF_TOKEN": "$HF_TOKEN"}
    })
"""

import os
from datasets import load_dataset
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig
import trackio

# Configuration
BASE_MODEL = os.environ.get("BASE_MODEL", "Qwen/Qwen2.5-7B-Instruct")
DATASET_ID = os.environ.get("DATASET_ID", "caesarniseko/niseko-gazet-editorial-data")
OUTPUT_REPO = os.environ.get("OUTPUT_REPO", "caesarniseko/cizer-v1-sft")
NUM_EPOCHS = int(os.environ.get("NUM_EPOCHS", "3"))
LEARNING_RATE = float(os.environ.get("LEARNING_RATE", "2e-4"))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "1"))
GRAD_ACCUM = int(os.environ.get("GRAD_ACCUM", "8"))
MAX_LENGTH = int(os.environ.get("MAX_LENGTH", "2048"))

print(f"=== Cizer SFT Training ===")
print(f"Base model: {BASE_MODEL}")
print(f"Dataset: {DATASET_ID}")
print(f"Output: {OUTPUT_REPO}")
print(f"Epochs: {NUM_EPOCHS}, LR: {LEARNING_RATE}")
print(f"Batch: {BATCH_SIZE} x {GRAD_ACCUM} grad_accum")

# Load dataset
dataset = load_dataset(DATASET_ID, split="train")
print(f"Dataset loaded: {len(dataset)} examples")

# If dataset is small, skip eval split to save memory
if len(dataset) > 20:
    dataset_split = dataset.train_test_split(test_size=0.1, seed=42)
    train_dataset = dataset_split["train"]
    eval_dataset = dataset_split["test"]
    eval_strategy = "steps"
    eval_steps = 50
else:
    train_dataset = dataset
    eval_dataset = None
    eval_strategy = "no"
    eval_steps = None

# LoRA configuration for efficient fine-tuning
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    target_modules="all-linear",
    task_type="CAUSAL_LM",
)

# Training configuration
training_args = SFTConfig(
    output_dir="cizer-v1-sft",
    push_to_hub=True,
    hub_model_id=OUTPUT_REPO,
    hub_strategy="every_save",
    hub_private_repo=True,
    num_train_epochs=NUM_EPOCHS,
    per_device_train_batch_size=BATCH_SIZE,
    gradient_accumulation_steps=GRAD_ACCUM,
    gradient_checkpointing=True,
    learning_rate=LEARNING_RATE,
    lr_scheduler_type="cosine",
    warmup_ratio=0.1,
    max_length=MAX_LENGTH,
    logging_steps=10,
    save_strategy="steps",
    save_steps=100,
    save_total_limit=3,
    eval_strategy=eval_strategy,
    eval_steps=eval_steps,
    bf16=True,
    report_to="trackio",
    project="niseko-gazet-cizer",
    run_name="cizer-v1-sft-qwen2.5-7b",
    seed=42,
)

# Initialize trainer
trainer = SFTTrainer(
    model=BASE_MODEL,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    peft_config=lora_config,
    args=training_args,
)

print(f"Training parameters: {trainer.model.num_parameters():,}")
print(f"Trainable parameters: {sum(p.numel() for p in trainer.model.parameters() if p.requires_grad):,}")

# Train
trainer.train()

# Push final model to Hub
trainer.push_to_hub()
print(f"Model pushed to: https://huggingface.co/{OUTPUT_REPO}")
print("=== Cizer SFT Training Complete ===")
