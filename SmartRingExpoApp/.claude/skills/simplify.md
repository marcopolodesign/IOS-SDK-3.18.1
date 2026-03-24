---
name: simplify
description: Review changed code for reuse, quality, and efficiency, then fix any issues found.
---

# Simplify: Code Review

Review all changed files for reuse, quality, and efficiency. Fix any issues found.

## Step 1: Get the diff

Run `git diff` (or `git diff HEAD` if there are staged changes) to see what changed.

## Step 2: Review

Launch a **single** reviewer agent using `subagent_type: "reviewer"` and `model: "sonnet"`. Pass the full diff. The agent reviews for ALL concerns in one pass:

- **Reuse:** existing utilities that could replace new code, duplicated functionality
- **Quality:** redundant state, copy-paste, leaky abstractions, stringly-typed code
- **Efficiency:** redundant computations, missed concurrency, memory leaks, overly broad operations

## Step 3: Apply fixes

The agent fixes issues directly. When done, briefly summarize what was fixed or confirm clean.
