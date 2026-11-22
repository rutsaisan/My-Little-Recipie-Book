"""Pasa a texto el audio de un vídeo con Whisper (en este ordenador).

Lee de la entrada estándar audio PCM de 16 bits, mono, a 16 kHz (el navegador
ya lo ha preparado así, de modo que no hace falta ffmpeg) y escribe en la
salida estándar un JSON con el texto y los fragmentos con su tiempo.

Uso: python transcribe.py [modelo] [idioma]
"""
import json
import sys
import warnings


def main() -> None:
    model_name = sys.argv[1] if len(sys.argv) > 1 else "base"
    language = sys.argv[2] if len(sys.argv) > 2 else "es"
    warnings.filterwarnings("ignore")

    try:
        import numpy as np
        import whisper
    except ImportError as error:  # pragma: no cover - depende de la instalación
        print(json.dumps({"error": f"Falta un paquete de Python: {error.name}. Instala openai-whisper."}))
        sys.exit(2)

    raw = sys.stdin.buffer.read()
    if len(raw) < 3200:  # menos de 0,1 s
        print(json.dumps({"text": "", "language": language, "segments": []}))
        return

    audio = np.frombuffer(raw[: len(raw) - len(raw) % 2], dtype=np.int16).astype(np.float32) / 32768.0
    model = whisper.load_model(model_name)
    result = model.transcribe(audio, language=language or None, fp16=False, verbose=None)
    segments = [
        {"start": round(float(s["start"]), 2), "end": round(float(s["end"]), 2), "text": s["text"].strip()}
        for s in result.get("segments", [])
    ]
    out = {"text": result.get("text", "").strip(), "language": result.get("language", language), "segments": segments}
    sys.stdout.buffer.write(json.dumps(out, ensure_ascii=False).encode("utf-8"))


if __name__ == "__main__":
    main()
