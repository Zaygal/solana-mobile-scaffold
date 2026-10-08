# Clock In demo v2

\`clock-in-demo-v2.mp4\` is the 88.05 second director's cut of the existing real Clock In film.

## Source

The source is \`clock-in-demo.mp4\`, the original 1:28 product film already committed to this repository. No UI was regenerated and no wallet approval was simulated.

## Edit

The render keeps the original 1920x1080 footage and audio, then adds restrained beat labels:

1. The claim
2. The act
3. The seal
4. The verifier
5. The limits

The clean export is \`clock-in-demo-v2.mp4\`.

\`clock-in-demo-v2-captioned.mp4\` is the same cut with the verified SRT captions burned into the picture. \`clock-in-demo-v2.srt\` is the sidecar subtitle file.

## Evidence policy

The edit does not add claims that are absent from the original film. In particular, it does not claim that a storage wipe or reinstall was filmed. The original film README explicitly records that this shot was not captured.

The film's own evidence includes the real devnet transaction, Mobile Wallet Adapter approval, the standalone verifier output, and the explicit self-reported limitation.

## Reproduce

From the repository root:

\`\`\`bash
chmod +x film/render-demo.sh
film/render-demo.sh
\`\`\`

The script uses ffmpeg and the committed source film. It prints codec, resolution and duration for both outputs before committing them in CI.
