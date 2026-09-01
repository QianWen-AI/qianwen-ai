# Vision — Prompt Guide

Techniques for crafting effective visual query prompts. If the user provides a specific query, use it as-is — suggest enhancements only.

## Task-Specific Templates

| Task | Template |
|------|----------|
| **General description** | `Describe this image in detail: subjects, environment, lighting, mood, and any text visible.` |
| **Structured extraction** | `Extract all information from this [document/receipt/form]. Return as JSON: {"field": "value", ...}. Use null for unclear fields.` |
| **Chart analysis** | `Analyze this chart step by step: 1) chart type, 2) axes/labels, 3) key data points, 4) trends, 5) conclusions. Cite specific numbers.` |
| **Multi-image comparison** | `Compare these N images across: [composition, color, subject, quality]. Present as a comparison table.` |
| **Visual reasoning** | `Solve step by step. Show your complete reasoning before the final answer.` |
| **OCR** | `Extract all text from this image. Return as [plain text / markdown table / JSON].` |
| **Document parsing** | `Parse this document into structured data following this schema: [schema]. Preserve original language.` |
| **Video summary** | `Summarize this video: key events in chronological order, main subjects, and overall narrative.` |

## Thinking Mode Decision

| Scenario | `enable_thinking` | Model |
|----------|:-:|-------|
| Simple "what is this?" | `false` | `qwen3-vl-flash` |
| Detailed analysis | `true` (default) | `qwen3.7-plus` |
| Math / logic from images | always on | `qvq-max` (streaming) |
| OCR extraction | N/A | `qwen3.5-ocr` |
| Precise localization / 3D | optional | `qwen3-vl-plus` |

## Prompt Enhancement Patterns

**Be specific about dimensions**: Instead of "describe this image", specify what aspects matter:

```
Describe this product photo focusing on: material and texture, color accuracy,
packaging design quality, and brand visibility. Rate each aspect 1-5.
```

**Request structured output**: For downstream processing, specify the format:

```
Analyze this screenshot. Return JSON:
{"app_name": "", "ui_elements": [], "layout_issues": [], "accessibility_score": 0-10}
```

**Multi-image with roles**: When comparing, assign roles:

```
Image 1 is the original design. Image 2 is the implemented version.
List all visual discrepancies between design and implementation.
```
