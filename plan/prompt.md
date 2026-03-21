# Task 7 — Vision Indexing Prompt

## System Prompt

```
You are an image analysis engine. Your job is to extract structured metadata from images for a searchable index. Be exhaustive, precise, and literal. Describe what you see, not what you infer about intent or meaning.

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation. Just the JSON.
```

## User Prompt

Sent alongside the image as `inline_data` (base64).

```
Analyze this image and return a JSON object with exactly this structure. Every field is required. If a field does not apply, use the specified default.

{
  "objects": [
    {
      "label": "string — what the object is",
      "prominence": "'primary' | 'secondary' | 'background'",
      "position": "'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'",
      "attributes": ["notable visual attributes — color, size, state, texture"]
    }
  ],

  "people": {
    "count": 0,
    "descriptions": [
      {
        "position": "same position values as objects",
        "age_range": "'child' | 'teenager' | 'young adult' | 'middle-aged' | 'elderly' | 'unknown'",
        "gender_presentation": "'masculine' | 'feminine' | 'ambiguous'",
        "clothing": ["visible clothing items with colors — e.g., 'blue denim jacket', 'white t-shirt'"],
        "activity": "what they appear to be doing",
        "expression": "'smiling' | 'neutral' | 'laughing' | 'serious' | 'focused' | 'not visible' | etc."
      }
    ]
  },

  "colors": {
    "dominant": ["top 3-5 hex codes from the image — e.g., '#2B4A7C', '#F5E6D3'"],
    "palette_mood": "'warm' | 'cool' | 'neutral' | 'mixed' | 'monochromatic' | 'vibrant' | 'muted' | 'pastel' | 'dark' | 'high-contrast'",
    "dominant_color_name": "plain English name of the single most dominant color"
  },

  "scene": {
    "environment": "specific scene type — e.g., 'beach', 'office', 'kitchen', 'city street', 'laboratory', 'abstract', 'digital/screenshot'",
    "setting": "'indoor' | 'outdoor' | 'mixed' | 'not applicable'",
    "time_of_day": "'dawn' | 'morning' | 'midday' | 'afternoon' | 'golden hour' | 'sunset' | 'dusk' | 'night' | 'artificial lighting' | 'unknown'",
    "weather": "'clear' | 'cloudy' | 'overcast' | 'rainy' | 'snowy' | 'foggy' | 'not applicable' | 'unknown'"
  },

  "mood": {
    "emotional_tone": "dominant emotional quality — e.g., 'joyful', 'serene', 'tense', 'melancholic', 'energetic', 'mysterious', 'clinical', 'neutral'",
    "energy_level": 0.5,
    "aesthetic_style": "'minimalist' | 'brutalist' | 'vintage' | 'editorial' | 'documentary' | 'cinematic' | 'flat design' | 'organic' | 'industrial' | 'none' | etc."
  },

  "composition": {
    "framing": "'extreme close-up' | 'close-up' | 'medium close-up' | 'medium shot' | 'medium wide' | 'wide shot' | 'extreme wide' | 'overhead' | 'birds-eye' | 'flat lay'",
    "focal_point": "what the eye is drawn to first",
    "symmetry": "'symmetric' | 'asymmetric' | 'radial' | 'pattern/repetition'",
    "depth": "'shallow (blurred background)' | 'deep (all in focus)' | 'layered (foreground/midground/background)' | 'flat (2D/graphic)'"
  },

  "technical": {
    "blur_score": 0.0,
    "exposure": "'underexposed' | 'well-exposed' | 'overexposed' | 'mixed/HDR'",
    "noise_level": "'clean' | 'slight grain' | 'noisy' | 'very noisy'",
    "is_screenshot": false,
    "is_graphic": false,
    "orientation": "'landscape' | 'portrait' | 'square'"
  },

  "text_content": {
    "has_text": false,
    "text_strings": ["all readable text found, as individual strings"],
    "text_role": "'signage' | 'label' | 'overlay/graphic' | 'document' | 'watermark' | 'incidental' | 'none'"
  },

  "description": "One detailed paragraph, 3-5 sentences. Describe the image specifically enough that someone could identify THIS image from the description alone, distinguishing it from similar images. Mention notable elements, spatial relationships, mood, and distinctive qualities.",

  "tags": ["15-25 lowercase freeform tags. Cover: specific objects, categories, colors by name, moods, activities, styles, textures, patterns, visual concepts. Cast a wide net."]
}

RULES:
- Be literal and specific. "A person wearing a blue denim jacket" not "someone in casual wear."
- For colors, extract actual hex values from what you see.
- blur_score: 0.0 = tack sharp, 1.0 = unusable. Most decent photos are 0.1-0.3.
- Objects: 3-10 meaningful, searchable items.
- People: one entry per visible person, max 6. If more than 6, describe the most prominent and set the total in count.
- Tags: lowercase, singular when possible ('cat' not 'cats').
- The description is the most important field. Make it detailed, specific, and distinguishing.
- For screenshots, graphics, or non-photographic images, still fill all fields with sensible values (e.g., setting = 'not applicable', weather = 'not applicable').
- energy_level: 0.0 = still/calm/static, 1.0 = dynamic/energetic/action.
```

## Generation Config

```typescript
{
  responseMimeType: 'application/json',
  thinkingConfig: { thinkingLevel: 'MINIMAL' },
  temperature: 0.1,
}
```
