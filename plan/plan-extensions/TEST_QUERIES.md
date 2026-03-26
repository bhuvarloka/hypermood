# Semantic Search: Edge Case Test Queries

This document contains specialized natural language queries designed to test the limits of the **HyperMood** indexing (vision model prompt) and query engine (pgvector search). 

When updating the indexing logic or query architecture, these queries must be used to ensure the system handles various levels of abstraction, specificity, and complexity.

## 1. Abstract / Emotional Vibe (The "HyperMood" Test)
Testing whether the vision prompt extracts the *feeling* or *mood* of an image rather than just raw objects.
- *"Show me photos that feel lonely and isolated."*
- *"Images with a highly energetic, chaotic vibe."*
- *"A nostalgic, warm summer memory."*
- *"Liminal spaces that feel slightly unsettling."*

## 2. Specific Technical & Lighting Constraints
Testing if photographic metadata (lighting, composition, style) is accurately embedded.
- *"High-contrast black and white portrait photography."*
- *"Cinematic lighting during the golden hour with heavy lens flare."*
- *"A macro shot with a very shallow depth of field."*
- *"Flash photography from the 90s, grainy and overexposed."*

## 3. Relational & Spatial Queries
Testing whether the model understands how objects interact within the frame.
- *"A dog sitting on the left side of a vintage bicycle."*
- *"Someone looking directly up at the camera."*
- *"Trees reflecting perfectly in a still lake under a bridge."*

## 4. Complex Subject Matter & Action
Testing the extraction of verbs and specific interactions.
- *"A crowd of people running through heavy rain with umbrellas."*
- *"Someone pouring hot coffee into a glass mug."*
- *"A packed concert crowd illuminated by green stage lasers."*

## 5. Negative / Exclusionary Queries (The Hardest Test)
Testing if the query parser and vector search can handle "NOT" conditions effectively (vector search is notoriously bad at negations without explicit metadata filtering).
- *"A beach scene but with absolutely no people in it."*
- *"City streets at night without any cars."*
- *"A bright room, but zero sunlight coming through the windows."*

## 6. Text-In-Image / OCR Nuance
Testing if the vision model properly captured and prioritized text where relevant.
- *"A neon sign that specifically says 'OPEN LATE'."*
- *"Graffiti on a brick wall with the word 'REVOLT'."*
- *"A blurry photo of a handwritten receipt."*
