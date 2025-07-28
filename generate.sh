#!/bin/bash

# TruthSource Code Generator
# Wrapper script for the CLI generator

# Use npx to run tsx if not installed locally
if command -v tsx &> /dev/null; then
  tsx cli/index.ts "$@"
else
  npx tsx cli/index.ts "$@"
fi