# AI folder map

A short map of the folders git tracks in the checkout, with how many files are under each, for an
agent's prompt. It saves the agent the turns it would spend listing directories.

Used by [`ai-plan`](../ai/ai-plan.md) and the first build of [`ai-implement`](../ai/ai-implement.md).

```yaml
- id: folders
  uses: uniquesca/ci/ai-folder-map@v11

# then, inside the agent's prompt
#   ${{ steps.folders.outputs.text }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `depth` | no | `3` | How many levels of folders to show at most. A map over `max_lines` shows fewer |
| `max_lines` | no | `100` | How long the map may be, in lines |

## Outputs

| Output | Description |
|---|---|
| `text` | The paragraph with the map in it, as markdown. Empty when git tracks no folders |

## Dig deeper

### What the map leaves out

Only tracked files count, so ignored dependencies and build output never appear. A committed
`node_modules`, `vendor`, `dist` or `build` is one line that is never opened. Each folder shows at
most its 12 biggest subfolders and counts the rest, and a map longer than `max_lines` loses a level
of depth until it fits.
