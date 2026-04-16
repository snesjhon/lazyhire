# lazyhire — Build your profile once
# Demo: first-launch onboarding via Resume PDF URL
# Run: vhs docs/tapes/onboarding.tape

Output docs/gifs/onboarding.gif

Set FontSize 14
Set Width 1400
Set Height 900
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set BorderRadius 8
Set Padding 12
Set TypingSpeed 75ms
Set PlaybackSpeed 1.25

# Temporarily hide the real profile so onboarding triggers.
# HOME is left untouched so claude auth works normally.
Hide
Type "mv ~/.lazyhire/profile.json ~/.lazyhire/profile.json.bak"
Enter
Sleep 300ms
Show

# Launch lazyhire — no profile found, onboarding starts immediately
Type "lazyhire"
Sleep 200ms
Enter

# Wait for TUI to boot and render the initial menu
Sleep 2s

# "Resume PDF URL" is the first option — already highlighted, press Enter
Enter

# URL input prompt appears
Sleep 800ms
Type "https://snesjhon.com/resume.pdf"
Sleep 400ms
Enter

# Extraction runs: fetches the PDF then calls Claude to parse it.
# This takes a moment — give it enough room.
Sleep 30s

# ── Wizard: 13 steps (pre-filled from resume) ────────────────────────────── #
# Just confirm each pre-filled value with Enter.

# 1/13  Candidate name
Sleep 800ms
Enter

# 2/13  Candidate email
Sleep 700ms
Enter

# 3/13  Candidate location
Sleep 700ms
Enter

# 4/13  Candidate site
Sleep 700ms
Enter

# 5/13  Headline
Sleep 700ms
Enter

# 6/13  Education  (textarea — Ctrl+O to submit)
Sleep 700ms
Ctrl+O

# 7/13  Target roles
Sleep 700ms
Enter

# 8/13  Target categories
Sleep 700ms
Enter

# 9/13  Target focuses
Sleep 700ms
Enter

# 10/13  Minimum salary
Sleep 700ms
Enter

# 11/13  Maximum salary
Sleep 700ms
Enter

# 12/13  Remote preference (select)
Sleep 700ms
Enter

# 13/13  Deal-breakers
Sleep 700ms
Enter

# Profile saved — dashboard loads with flash message
Sleep 3s

# Restore the real profile
Hide
Type "mv ~/.lazyhire/profile.json.bak ~/.lazyhire/profile.json"
Enter
Sleep 300ms
