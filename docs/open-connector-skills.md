# Open Connector skills (WhatsAI)

WhatsAI talks to [Open Connector](https://connect.yishaik.com) with a **dedicated runtime token** (`whatsai`). Personas never see the token. The token allowlist is the security boundary; the skill catalog is what the UI can attach to a persona.

## Live skills

| Skill | Actions | Connection |
| --- | --- | --- |
| `youtube_stats` | `youtube.list_channels`, `list_videos`, `list_playlist_items`, `list_playlists`, `search` | `youtube` / `default` |
| `mx_lookup` | `mx_toolbox.lookup_{mx,spf,dmarc,dns,dkim,blacklist,mta_sts_record,bimi_record,http,ping}` | `MxToolbox-theyishaik` |
| `telegram_notify` | `telegram.send_message`, `telegram.get_me` | `telegram` / `ops` |

New skills default **off**. Enable on one persona in a private room to test.

## Add a skill

1. Propose skill id, Action ids, connection alias, read vs write, and which template.
2. Add Action ids (and write-connection id) on the `whatsai` token **before** shipping UI.
3. Wrap in `lib/openConnector.js` + `TOOL_DECLS` in `api/persona-response.ts` + `services/skills.ts`.
4. Leave existing personas unchanged. Optionally add one template.
5. Private-room smoke test; confirm the run in Open Connector → Runs (`caller: http`).
6. Log the row in this table.

Do not add a skill only in the UI. Do not widen the token “for later.”
