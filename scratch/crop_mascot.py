import os
from PIL import Image

src_path = r"C:\Users\Mukesh\.gemini\antigravity-ide\brain\438d4b8f-7676-4529-943e-4737d0ebfcff\media__1784192093203.png"
dest_dir = r"c:\Users\Mukesh\.gemini\antigravity\scratch\myntra-clone\public\mascot"
os.makedirs(dest_dir, exist_ok=True)

img = Image.open(src_path)
width, height = img.size

# Estimated bounding boxes based on a 1024x498 character turnaround image
# We will pad them slightly to make sure we don't clip any part of the character
# Waving Aarohi on the left: let's crop from x=210 to x=480 to avoid the brand text, and y=25 to y=498
waving_img = img.crop((210, 25, 480, 498))
waving_img.save(os.path.join(dest_dir, "aarohi_waving.png"))

# Turnaround figures on the right
# They span from y=52 (top of hair, below the badge) to y=445 (bottom of sandals, above the label text).
# Horizontal regions:
# Front View: ~500 to ~615
# 3/4 View: ~635 to ~750
# Side View: ~768 to ~865 (shrunk to avoid the 3/4 view scarf on the left)
# Back View: ~890 to ~990 (shrunk to avoid the side view on the left)
img.crop((500, 52, 615, 445)).save(os.path.join(dest_dir, "aarohi_front.png"))
img.crop((635, 52, 750, 445)).save(os.path.join(dest_dir, "aarohi_three_quarter.png"))
img.crop((768, 52, 865, 445)).save(os.path.join(dest_dir, "aarohi_side.png"))
img.crop((890, 52, 990, 445)).save(os.path.join(dest_dir, "aarohi_back.png"))

print("Cropping completed successfully!")
