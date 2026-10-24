import { Upload, Image } from "lucide-react";

interface AvatarUploadProps {
  src: string | null;
  onChange: (file: File) => void;
  disabled?: boolean;
}

export function AvatarUpload({ src, onChange, disabled }: AvatarUploadProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        {src ? (
          <img
            src={src}
            alt="Avatar"
            className="w-24 h-24 rounded-full object-cover border border-border bg-muted"
          />
        ) : (
          <div className="w-24 h-24 rounded-full border-2 border-dashed border-border bg-muted flex items-center justify-center">
            <Upload size={24} className="text-muted-foreground" />
          </div>
        )}
        <label className="absolute bottom-0 right-0 flex items-center justify-center w-8 h-8 rounded-full bg-accent text-accent-foreground cursor-pointer hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:pointer-events-none">
          <Image size={14} strokeWidth={2.5} />
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onChange(file);
            }}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Foto do perfil (PNG/JPG, até 2 MB)
      </p>
    </div>
  );
}
