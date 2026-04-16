# lazyhire — intro / hero demo
# Shows: dashboard navigation → add job → evaluation → score
# Run: vhs docs/tapes/intro.tape

Output docs/gifs/intro.mp4

Set FontSize 20
Set Width 2000
Set Height 1200
Set Theme "Catppuccin Frappe"
Set WindowBar Colorful
Set BorderRadius 8
Set Padding 12
Set TypingSpeed 50ms
Set PlaybackSpeed 1.25

# Launch into the existing dashboard (real profile + jobs — no faking needed)
Type "lazyhire"
Sleep 2s
Enter

Sleep 2s

# Browse existing jobs to show the populated UI
Down
Sleep 500ms
Down
Sleep 500ms
Down
Sleep 600ms

# Cycle through panel tabs to show the layout
Tab
Sleep 800ms
Tab
Sleep 800ms
Tab
Sleep 600ms

# Back to jobs panel, land on a job
Up
Sleep 400ms
Up
Sleep 600ms

# ── Add a new job ────────────────────────────────────────────────────────── #

# Open the add-job menu
Type "a"
Sleep 800ms

# "Paste job link" is the first option — already highlighted, select it
Enter
Sleep 800ms

# Type the job URL
Type "https://jobs.ashbyhq.com/vanta/886f16d2-236f-4059-b7f3-101848ab8510"
Sleep 400ms
Enter

# Show the loading spinner briefly, then hide the rest of the wait
Sleep 3s
Hide
Sleep 80s
Show

# Score is back — flash message appears, job lands in Queue
Sleep 2s

# Open job actions menu
Enter
Sleep 800ms

# Scroll down twice to land on Generate Resume, then select it
Down
Sleep 400ms
Down
Sleep 400ms
Enter

Sleep 3s
