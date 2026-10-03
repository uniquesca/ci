# AI style guide

The writing rules every AI agent's prompt carries - lead with the conclusion, no narration, no
hedging, no restating, no internal file names. The rules are in
[`ai-style-guide/style.md`](../../ai-style-guide/style.md).

Used by [`ai-implement`](../ai/ai-implement.md) and [`ai-review`](../ai/ai-review.md).

```yaml
- id: style
  uses: uniquesca/ci/ai-style-guide@v11

# then, inside the agent's prompt
#   ${{ steps.style.outputs.text }}
```

## Inputs

This action takes no inputs.

## Outputs

| Output | Description |
|---|---|
| `text` | The style guide, as markdown |
