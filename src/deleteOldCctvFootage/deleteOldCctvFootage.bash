#!/usr/bin/env python3

#LLM based (GPT-4o)

print("monoblokk2 | begin to delete old cctv footage")

#!/usr/bin/env python3

import os
import re
import time
from datetime import datetime, timedelta

# Define regex for the filename format
FILENAME_PATTERN = re.compile(r'^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})-(\d{6})\.mp4$')

# Calculate cutoff datetime (1 month ago)
cutoff = datetime.now() - timedelta(days=40)

# Root directory (script location)
root_dir = os.path.abspath(os.path.dirname(__file__))

deleted = 0
skipped = 0

for dirpath, _, filenames in os.walk(root_dir):
    for filename in filenames:
        match = FILENAME_PATTERN.match(filename)
        if match:
            # Build datetime object from filename
            try:
                file_dt = datetime(
                    int(match.group(1)), int(match.group(2)), int(match.group(3)),
                    int(match.group(4)), int(match.group(5)), int(match.group(6))
                )
                if file_dt < cutoff:
                    full_path = os.path.join(dirpath, filename)
                    os.remove(full_path)
                    print(f"Deleted: {full_path}")
                    deleted += 1
                else:
                    skipped += 1
            except ValueError:
                skipped += 1
        else:
            skipped += 1

print(f"\nFinished. Deleted: {deleted} files. Skipped: {skipped} files.")

print("monoblokk2 | delete done!")