# Audio

The prototype generates its soundscape with WebAudio (`src/audio/AudioEngine.ts`): wind, birds and a
chime when a zone lights up. No audio files are required or shipped.

To use real recordings later, add the files here (for example `ambience-forest.ogg`, `chime.ogg`) and
load them in `AudioEngine`. Keep them short, looped and under ~300 KB each so the preview stays light.
