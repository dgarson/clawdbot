---
name: lg-webos-tv
description: Control LG webOS TVs over the network using SSAP discovery, registration, and command patterns.
homepage: https://github.com/supersaiyanmode/PyWebOSTV
metadata:
{
"openclaw": {
"emoji": "📺"
}
}
---

# LG webOS TV Control

Use this skill to control LG webOS TVs on the local network via the SSAP WebSocket API.

Validated sources

- LG Connect SDK test fixtures confirm SSDP discovery using the `urn:lge-com:service:webos-second-screen:1` service type and a service ID that includes `3000-3001` (ports exposed by the TV).
  - https://github.com/ConnectSDK/Connect-SDK-Android-Core/blob/master/test/src/com/connectsdk/discovery/provider/SSDPDiscoveryProviderTest.java
  - https://github.com/ConnectSDK/Connect-SDK-Android-Core/blob/master/test/src/com/connectsdk/discovery/provider/ssdp/SSDPDeviceTest.java
- PyWebOSTV README documents registration flow, `client_key` persistence, and secure WebSocket usage for newer models.
  - https://github.com/supersaiyanmode/PyWebOSTV/blob/master/README.md
- lgtv2 README documents the `ws://<host>:3000` endpoint, SSAP request usage, and the requirement to enable LG Connect Apps.
  - https://github.com/hobbyquaker/lgtv2/blob/master/README.md

Prerequisites on the TV

- Enable LG Connect Apps in TV settings (LG Connect Apps must be allowed for pairing).
- If you plan to wake the TV with Wake-on-LAN, enable the relevant power or mobile TV on settings (newer models often call this Mobile TV On / Turn On via Wi-Fi).

Home-network specialization (collect once, reuse forever)

- TV IP (static or DHCP reservation).
- TV MAC address (for Wake-on-LAN).
- WebSocket mode: `ws` (port 3000) or `wss` (port 3001).
- Persisted `client_key` after first pairing.
- Favorite app IDs and input IDs (from app/input listings).

Store these values in a local config file or secret store (never commit real values). Example template:

```yaml
lg_webos:
  ip: "192.0.2.50"
  mac: "AA:BB:CC:DD:EE:FF"
  secure: true
  client_key: "REDACTED"
  favorite_apps:
    netflix: "netflix"
    youtube: "youtube.leanback.v4"
  favorite_inputs:
    hdmi1: "HDMI_1"
```

Discovery

- Send an SSDP M-SEARCH to `239.255.255.250:1900` with the service type `urn:lge-com:service:webos-second-screen:1`.
- The returned device description advertises a service ID that includes `webos-second-screen-3000-3001`, indicating the WebSocket ports to use.
- If SSDP discovery fails on the LAN (multicast blocked), fall back to the stored TV IP.

Connection and authentication

- Use `ws://<tv-ip>:3000` for standard WebSocket, or `wss://<tv-ip>:3001` for secure WebSocket on newer models.
- First registration triggers a prompt on the TV. Persist the returned `client_key` and reuse it to avoid repeated prompts.

Common control surface

- Audio: volume up/down, set volume, mute, audio output.
- Apps: list installed apps, launch by ID, get foreground app.
- Inputs: list sources, switch HDMI inputs.
- System: power off, screen on/off, toast notifications, system info.
- Remote: D-pad, enter, back, home, keyboard input, pointer.
- TV channels: list channels, change channel, EPG info (if live TV supported).

Wake-on-LAN power-on

- Power-on requires Wake-on-LAN (WOL). Ensure the TV supports WOL and the setting is enabled.
- Example command (use stored MAC): `wakeonlan AA:BB:CC:DD:EE:FF`.

Quick start with Python (pywebostv)

```python
from pywebostv.connection import WebOSClient
from pywebostv.controls import MediaControl, ApplicationControl

client = WebOSClient.discover(secure=True)[0]
client.connect()
store = {}  # Persist this dict to disk to reuse client_key later.
for status in client.register(store):
    print(status)  # Accept the pairing prompt on the TV.

media = MediaControl(client)
media.set_volume(15)

apps = ApplicationControl(client).list_apps()
print([app["title"] for app in apps])
```

Quick start with Node.js (lgtv2)

```js
const lgtv = require("lgtv2")({
  url: "ws://<tv-ip>:3000",
});

lgtv.on("connect", () => {
  lgtv.request("ssap://audio/setVolume", { volume: 10 });
  lgtv.request("ssap://system.launcher/launch", { id: "netflix" });
});
```

Notes for OpenClaw usage

- Always ask for the TV IP or run SSDP discovery if a tool/script is available.
- On first pairing, instruct the user to accept the prompt on the TV.
- Store the `client_key` in a local config file or secret store so future sessions auto-authenticate.
- For power-on, use Wake-on-LAN with the TV MAC address; SSAP only works once the TV is awake.
