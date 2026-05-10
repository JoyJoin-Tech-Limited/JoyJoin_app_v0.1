import re
with open("/Users/vincentlai/GitHub/JoyJoin_app_v0.1/apps/mini-program/dist/common.js") as f:
    content = f.read()
matches = re.findall(r"\.\./\.\./assets/[^\"\'\s]+", content)
unique = sorted(set(matches))
for m in unique:
    print(m)
