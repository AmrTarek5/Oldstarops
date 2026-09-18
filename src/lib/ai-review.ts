import Anthropic from "@anthropic-ai/sdk";

export interface AiPhotoReview {
  condition: "good" | "worn" | "damaged" | "unclear";
  matchesReason: boolean;
  notes: string;
  flagForHumanReview: boolean;
}

/**
 * Layer 2 AI photo review: a best-effort automated pass on the customer's
 * uploaded photos before a human looks at the request. This never makes the
 * accept/reject decision by itself - it only attaches a note for the
 * requests inbox reviewer. If the API key is missing or the call fails, we
 * skip it silently rather than blocking the customer's submission.
 */
export async function reviewReturnPhotos(input: {
  photoUrls: string[];
  itemTitle: string;
  reason: string;
  notes?: string;
}): Promise<AiPhotoReview | null> {
  if (!process.env.ANTHROPIC_API_KEY || input.photoUrls.length === 0) return null;

  const client = new Anthropic();

  const prompt = `A customer is requesting a return/exchange for "${input.itemTitle}".
Stated reason: "${input.reason}"${input.notes ? `\nCustomer notes: "${input.notes}"` : ""}

Look at the attached photo(s) of the item's condition. Respond with ONLY a
single JSON object (no markdown, no prose) matching exactly this shape:
{
  "condition": "good" | "worn" | "damaged" | "unclear",
  "matchesReason": boolean,   // does the photo look consistent with the stated reason?
  "notes": string,            // one or two short sentences a human reviewer would find useful
  "flagForHumanReview": boolean // true if anything looks inconsistent, ambiguous, or needs a closer look
}`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 512,
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: [
            ...input.photoUrls.slice(0, 4).map(
              (url): Anthropic.ImageBlockParam => ({
                type: "image",
                source: { type: "url", url },
              })
            ),
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as AiPhotoReview;
    return parsed;
  } catch {
    // Best-effort only - never block a return submission on this.
    return null;
  }
}
