import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";

/**
 * Upload de imagem com preview. Converte o arquivo para um data-URL JPEG
 * redimensionado (lado maior ≤ 900px, qualidade 0.85) para caber no banco
 * (localStorage / JSON) sem estourar o limite de armazenamento.
 */
export default function ImageUpload({
  value,
  onChange,
  label = "Foto do produto",
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const readFile = (file: File) => {
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Envie um arquivo de imagem (JPG, PNG ou WebP).");
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 900;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#f4f7f9";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          onChange(dataUrl);
        } catch {
          setError("Não foi possível processar a imagem.");
        } finally {
          setBusy(false);
        }
      };
      img.onerror = () => {
        setError("Arquivo de imagem inválido.");
        setBusy(false);
      };
      img.src = String(reader.result);
    };
    reader.onerror = () => {
      setError("Falha ao ler o arquivo.");
      setBusy(false);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  return (
    <div>
      <span className="field-label">{label}</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={`group relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition ${
          dragOver ? "border-accent-500 bg-accent-50" : "border-ink-200 bg-ink-50 hover:border-accent-400 hover:bg-accent-50/50"
        }`}
      >
        {value ? (
          <>
            <img src={value} alt="Prévia" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center gap-2 bg-ink-950/55 text-[13px] font-bold text-white opacity-0 transition group-hover:opacity-100">
              <Upload size={16} /> Trocar foto
            </span>
          </>
        ) : busy ? (
          <span className="flex flex-col items-center gap-2 text-ink-400">
            <Loader2 size={26} className="animate-spin text-accent-500" />
            <span className="text-[13px] font-semibold">Processando imagem…</span>
          </span>
        ) : (
          <span className="flex flex-col items-center gap-2 px-4 text-center text-ink-400">
            <ImagePlus size={28} className="text-accent-500" />
            <span className="text-[13px] font-bold text-ink-600">Clique ou arraste uma foto aqui</span>
            <span className="text-[11.5px]">JPG, PNG ou WebP · redimensionada automaticamente</span>
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-1.5 text-[12px] font-semibold text-danger-600">{error}</p>}
    </div>
  );
}
