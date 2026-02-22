# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.

## workq Inbox Check
Call `workq_inbox_read` to check for pending messages. Process each one.
After processing, call `workq_inbox_ack` with the message IDs. This is REQUIRED.

