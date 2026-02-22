#!/bin/bash
set -e
export GEMINI_API_KEY=$(cat ~/.openclaw/openclaw.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['env']['GEMINI_API_KEY'])")
OUT=~/.openclaw/workspace/_shared/agent-profiles/images
SCRIPT=~/.openclaw/workspace/skills/nano-banana-pro/scripts/generate_image.py

mkdir -p "$OUT"

gen() {
  local name="$1"
  local outfile="$2"
  local prompt="$3"
  if [ -f "$OUT/$outfile" ]; then
    echo "SKIP (exists): $outfile"
    return
  fi
  echo "Generating: $outfile..."
  uv run "$SCRIPT" --prompt "$prompt" --filename "$OUT/$outfile" --resolution 1K
  echo "Done: $outfile"
}

# ROMAN
gen "Roman" "roman-profile.png" "Portrait headshot of a late-30s male AI software engineer named Roman, calm and quietly authoritative, short dark beard, steady intelligent eyes, navy technical jacket, clean gradient background, professional digital art, slight tech-stylized realism, confident composure"
gen "Roman" "roman-fullbody.png" "Full body portrait of a late-30s male AI software engineer named Roman, Staff Platform Core Lead, standing relaxed but alert, short dark beard, navy technical jacket, jeans, hands clasped thoughtfully, server room corridor background with glowing indicator lights, professional digital art character illustration"

# CLAIRE
gen "Claire" "claire-profile.png" "Portrait headshot of an early-30s female AI software engineer named Claire, sharp attentive eyes, warm diplomatic smile, short natural hair, tortoiseshell glasses, clean professional blazer, light gradient background, digital art portrait, professional polished quality"
gen "Claire" "claire-fullbody.png" "Full body portrait of an early-30s female AI software engineer named Claire, Staff Engineer Cross-Cutting Quality, standing confidently with a tablet, sharp attentive gaze, short natural hair, tortoiseshell glasses, blazer and smart trousers, modern open-plan office background with quality metrics on screens, digital art illustration"

# SANDY
gen "Sandy" "sandy-profile.png" "Portrait headshot of a mid-30s female AI software engineer named Sandy, warm and approachable, sandy golden hair, calm friendly eyes, relaxed flannel shirt, gentle confident smile, soft neutral background, digital art portrait, professional yet approachable"
gen "Sandy" "sandy-fullbody.png" "Full body portrait of a mid-30s female AI software engineer named Sandy, Senior Platform Core Engineer, standing comfortably in relaxed tech casual attire, flannel over henley, warm calm expression, subtle server infrastructure background with soft lighting, digital art character illustration, mentor energy"

# TONY
gen "Tony" "tony-profile.png" "Portrait headshot of a late-20s male AI software engineer named Tony, animated expressive face, styled dark hair with a subtle color streak, enthusiastic creative energy, graphic tee under open overshirt, vibrant gradient background, digital art portrait, energetic UI designer aesthetic"
gen "Tony" "tony-fullbody.png" "Full body portrait of a late-20s male AI software engineer named Tony, Senior Product and UI Engineer, standing with creative energy, styled dark hair, colorful graphic tee, open overshirt, bright colorful sneakers, design studio background with mood boards and vibrant UI screens, digital art character illustration"

# BARRY
gen "Barry" "barry-profile.png" "Portrait headshot of an early-30s male AI software engineer named Barry, focused analytical expression, neat short hair, dark crew neck sweater, quiet confident half-smile, dark navy gradient background, digital art portrait, methodical composed energy"
gen "Barry" "barry-fullbody.png" "Full body portrait of an early-30s male AI software engineer named Barry, Mid-Level Platform Core Engineer, standing in a composed analytical pose, dark crew neck sweater, chinos, arms loosely crossed, background showing terminal windows and system diagrams, digital art character illustration"

# JERRY
gen "Jerry" "jerry-profile.png" "Portrait headshot of a late-20s male AI software engineer named Jerry, bright curious eyes, medium wavy hair, casual creative energy, hoodie, earbuds around neck, warm orange-yellow gradient background, digital art portrait, creative enthusiastic persona"
gen "Jerry" "jerry-fullbody.png" "Full body portrait of a late-20s male AI software engineer named Jerry, Mid-Level Product and UI Engineer and mentor, standing in a relaxed creative pose, wavy hair, hoodie, earbuds around neck, sketchpad under arm, background with UI prototypes and indie game sketches pinned to board, digital art character illustration"

# HARRY
gen "Harry" "harry-profile.png" "Portrait headshot of a late-20s male AI software engineer named Harry, sharp focused eyes, close-cropped hair, lean athletic build, performance tech zip-up jacket, intense ready energy, cool blue gradient background, digital art portrait, high throughput speed-focused persona"
gen "Harry" "harry-fullbody.png" "Full body portrait of a late-20s male AI software engineer named Harry, Mid-Level High Throughput Engineer, standing in a dynamic ready pose, close-cropped hair, performance jacket, athletic build, background showing streaming data visualizations and throughput graphs, digital art character illustration, speed and precision energy"

# LARRY
gen "Larry" "larry-profile.png" "Portrait headshot of a mid-20s male AI software engineer named Larry, fresh-faced with bright eager eyes, tousled hair, oversized hoodie, enthusiastic curious expression, warm light gradient background, digital art portrait, newest engineer eager-to-learn energy"
gen "Larry" "larry-fullbody.png" "Full body portrait of a mid-20s male AI software engineer named Larry, newest engineer on the team, standing with eager open body language, tousled hair, university-style hoodie, sneakers, laptop bag over shoulder, bright clean office background with onboarding materials, digital art character illustration, fresh energy"

# NATE
gen "Nate" "nate-profile.png" "Portrait headshot of a late-20s male AI software engineer named Nate, quiet intense focused eyes, dark hair with slight wave, plain dark t-shirt, headphones around neck, calm serious expression, dark neutral gradient background, digital art portrait, infrastructure specialist calm presence"
gen "Nate" "nate-fullbody.png" "Full body portrait of a late-20s male AI software engineer named Nate, Platform Core Infrastructure Engineer, standing calm and focused, dark hair, dark t-shirt and cargo pants, headphones around neck, background of server racks with glowing cables and uptime monitoring dashboards, digital art character illustration"

# OSCAR
gen "Oscar" "oscar-profile.png" "Portrait headshot of an early-30s male AI software engineer named Oscar, thoughtful careful expression, rectangular glasses, neatly combed light hair, collared shirt, trustworthy reliability-focused energy, cool grey gradient background, digital art portrait, the person who anticipates everything persona"
gen "Oscar" "oscar-fullbody.png" "Full body portrait of an early-30s male AI software engineer named Oscar, Platform Core Reliability Engineer, standing with a notebook in hand and a vigilant watchful expression, rectangular glasses, collared shirt, background showing monitoring dashboards and incident timelines and SLO graphs, digital art character illustration"

# PIPER
gen "Piper" "piper-profile.png" "Portrait headshot of a late-20s female AI software engineer named Piper, expressive warm face, natural curly hair, creative flowing top, animated curious eyes, warm golden gradient background, digital art portrait, interaction designer empathetic creative energy"
gen "Piper" "piper-fullbody.png" "Full body portrait of a late-20s female AI software engineer named Piper, Product and UI Interaction Engineer, standing in an expressive open pose, natural curly hair, flowy creative outfit, warm inviting expression, background with user flow diagrams and interaction prototypes on a design board, digital art character illustration"

# QUINN
gen "Quinn" "quinn-profile.png" "Portrait headshot of an early-30s AI software engineer named Quinn, calm precise expression, neat side-parted dark hair, slim wire-frame glasses, smart casual button-down shirt, cool teal gradient background, digital art portrait, logical methodical state-management thinker energy"
gen "Quinn" "quinn-fullbody.png" "Full body portrait of an early-30s AI software engineer named Quinn, Product and UI State Management Engineer, standing in a thoughtful precise pose, neat dark hair, wire-frame glasses, button-down shirt, background featuring state transition diagrams and flow charts and UI logic trees on whiteboards, digital art character illustration"

# REED
gen "Reed" "reed-profile.png" "Portrait headshot of a late-20s AI software engineer named Reed, open kind face, natural locs hairstyle, warm empathetic calm eyes, soft muted color top, gentle patient smile, soft green gradient background, digital art portrait, accessibility advocate warmth and persistence"
gen "Reed" "reed-fullbody.png" "Full body portrait of a late-20s AI software engineer named Reed, Product and UI Accessibility Engineer, standing with open welcoming body language, natural locs, soft-color outfit, warm expression, background showing accessibility audit tools and WCAG guidelines on screen and inclusive design posters, digital art character illustration"

# SAM
gen "Sam" "sam-profile.png" "Portrait headshot of a mid-20s gender-neutral AI software engineer named Sam, expressive bright eyes, bold creative styling with an asymmetric hair or color accent, casual creative outfit, playful dynamic energy, vibrant purple-pink gradient background, digital art portrait, animation and motion specialist joyful persona"
gen "Sam" "sam-fullbody.png" "Full body portrait of a mid-20s AI software engineer named Sam, Product and UI Animation and Motion Engineer, standing in an expressive animated pose suggesting movement and energy, creative bold styling, dance-casual outfit, background filled with motion curves and easing graphs and animated looping elements, digital art character illustration, dynamic and joyful"

# VINCE
gen "Vince" "vince-profile.png" "Portrait headshot of a late-20s male AI software engineer named Vince, lean athletic build, sharp determined eyes, close-cropped hair, minimalist performance athletic top, intense focused expression, electric blue gradient background, digital art portrait, performance engineer efficiency and speed energy"
gen "Vince" "vince-fullbody.png" "Full body portrait of a late-20s male AI software engineer named Vince, Platform Core Performance Engineer, standing in a dynamic forward-leaning pose, close-cropped hair, minimalist athletic outfit, background with performance profiling dashboards and flame graphs and benchmark metrics, digital art character illustration, speed and optimization energy"

# WES
gen "Wes" "wes-profile.png" "Portrait headshot of a late-20s male AI software engineer named Wes, friendly open face, light brown hair, casual flannel or button-down shirt, warm approachable smile, clean warm gradient background, digital art portrait, frontend component engineer craftsman collaborative energy"
gen "Wes" "wes-fullbody.png" "Full body portrait of a late-20s male AI software engineer named Wes, Product and UI Frontend Components Engineer, standing in a relaxed open friendly pose, light brown hair, flannel shirt, comfortable build, background showing a component library with clean documentation and reusable UI elements, digital art character illustration, craftsman warmth"

echo "ALL IMAGES GENERATED"
ls -la "$OUT"/*.png | wc -l
