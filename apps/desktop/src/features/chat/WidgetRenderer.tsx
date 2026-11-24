"use client";

import { useState, useCallback } from "react";
import { Check, X, ArrowRight, Play, Pause, Star, Heart } from "@phosphor-icons/react";
import { useEchoApi } from "@/lib/api/echoApi";

export interface WidgetAction {
  id: string;
  label: string;
  style?: "primary" | "secondary" | "danger" | "success";
  icon?: string;
}

export interface WidgetField {
  id: string;
  type: "text" | "select" | "toggle";
  label: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
  defaultValue?: string | boolean;
}

export interface WidgetData {
  type: "poll" | "form" | "buttons" | "card" | "progress";
  title: string;
  description?: string;
  actions?: WidgetAction[];
  fields?: WidgetField[];
  /** Poll-specific */
  options?: { id: string; label: string; votes: number }[];
  totalVotes?: number;
  /** Progress-specific */
  progress?: number;
  max?: number;
  progressLabel?: string;
  /** Card-specific */
  imageUrl?: string;
  footer?: string;
  /** Metadata */
  authorId?: string;
  createdAt?: number;
}

export interface WidgetRendererProps {
  widget: WidgetData;
  eventId: string;
  myUserId?: string | null;
  align?: "left" | "right";
}

const ICON_MAP: Record<string, React.ElementType> = {
  check: Check,
  x: X,
  arrow: ArrowRight,
  play: Play,
  pause: Pause,
  star: Star,
  heart: Heart,
};

const STYLE_CLASSES: Record<string, string> = {
  primary: "bg-acc text-bg hover:bg-acc/90",
  secondary: "bg-surf2 text-txt hover:bg-surf3 border border-bd",
  danger: "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30",
  success: "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30",
};

export default function WidgetRenderer({ widget, eventId, align = "left" }: WidgetRendererProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const api = useEchoApi();

  const handleAction = useCallback(async (actionId: string) => {
    try {
      await api.submitWidgetAction("", eventId, { actionId });
    } catch (err) {
      console.warn(`[Widget:${eventId}] Action failed:`, err);
    }
  }, [api, eventId]);

  const handlePollVote = useCallback(async (optionId: string) => {
    if (submitted) return;
    setSelectedOption(optionId);
    setSubmitted(true);
    try {
      await api.submitWidgetAction("", eventId, { optionId });
    } catch (err) {
      console.warn(`[Widget:${eventId}] Poll vote failed:`, err);
    }
  }, [api, eventId, submitted]);

  const handleFormSubmit = useCallback(async () => {
    setSubmitted(true);
    try {
      await api.submitWidgetAction("", eventId, { formData });
    } catch (err) {
      console.warn(`[Widget:${eventId}] Form submit failed:`, err);
    }
  }, [api, eventId, formData]);

  const baseClasses = `w-full max-w-md rounded-xl border border-bd bg-card-bg/80 backdrop-blur overflow-hidden ${
    align === "right" ? "self-end" : "self-start"
  }`;

  switch (widget.type) {
    case "poll":
      return (
        <div className={baseClasses}>
          <div className="px-4 py-3 border-b border-bd">
            <h4 className="font-display text-sm font-semibold text-txt">{widget.title}</h4>
            {widget.description && <p className="text-xs text-mut mt-0.5">{widget.description}</p>}
          </div>
          <div className="p-3 space-y-2">
            {(widget.options ?? []).map((opt) => {
              const pct = widget.totalVotes ? Math.round((opt.votes / widget.totalVotes) * 100) : 0;
              const isSelected = selectedOption === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={submitted}
                  onClick={() => handlePollVote(opt.id)}
                  className={`relative w-full rounded-lg px-3 py-2 text-left text-sm transition-all ${
                    isSelected
                      ? "bg-acc/20 border border-acc/50 text-txt"
                      : "bg-surf hover:bg-surf2 border border-transparent text-txt/80"
                  } ${submitted ? "cursor-default" : "cursor-pointer"}`}
                >
                  <div className="relative z-10 flex items-center justify-between">
                    <span>{opt.label}</span>
                    {submitted && <span className="text-xs text-mut font-mono">{pct}%</span>}
                  </div>
                  {submitted && (
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg bg-acc/10 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  )}
                </button>
              );
            })}
            {widget.totalVotes !== undefined && submitted && (
              <p className="text-[11px] text-mut pt-1">{widget.totalVotes} votos</p>
            )}
          </div>
        </div>
      );

    case "buttons":
      return (
        <div className={baseClasses}>
          {(widget.title || widget.description) && (
            <div className="px-4 py-3 border-b border-bd">
              {widget.title && <h4 className="font-display text-sm font-semibold text-txt">{widget.title}</h4>}
              {widget.description && <p className="text-xs text-mut mt-0.5">{widget.description}</p>}
            </div>
          )}
          <div className="p-3 flex flex-wrap gap-2">
            {(widget.actions ?? []).map((action) => {
              const Icon = action.icon ? ICON_MAP[action.icon] : undefined;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleAction(action.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                    STYLE_CLASSES[action.style ?? "secondary"]
                  }`}
                >
                  {Icon && <Icon size={14} weight="bold" />}
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      );

    case "form":
      return (
        <div className={baseClasses}>
          <div className="px-4 py-3 border-b border-bd">
            <h4 className="font-display text-sm font-semibold text-txt">{widget.title}</h4>
            {widget.description && <p className="text-xs text-mut mt-0.5">{widget.description}</p>}
          </div>
          <div className="p-3 space-y-3">
            {(widget.fields ?? []).map((field) => (
              <div key={field.id}>
                <label className="block text-xs font-medium text-mut mb-1">{field.label}</label>
                {field.type === "text" && (
                  <input
                    type="text"
                    disabled={submitted}
                    placeholder={field.placeholder}
                    value={(formData[field.id] as string) ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    className="w-full rounded-lg border border-bd bg-surf px-3 py-1.5 text-sm text-txt placeholder:text-mut/50 focus:border-acc focus:outline-none"
                  />
                )}
                {field.type === "select" && (
                  <select
                    disabled={submitted}
                    value={(formData[field.id] as string) ?? field.defaultValue ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    className="w-full rounded-lg border border-bd bg-surf px-3 py-1.5 text-sm text-txt focus:border-acc focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    {(field.options ?? []).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
                {field.type === "toggle" && (
                  <button
                    type="button"
                    disabled={submitted}
                    onClick={() => setFormData((prev) => ({ ...prev, [field.id]: !prev[field.id] }))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      formData[field.id] ? "bg-acc text-bg" : "bg-surf2 text-mut border border-bd"
                    }`}
                  >
                    {formData[field.id] ? "Ativado" : "Desativado"}
                  </button>
                )}
              </div>
            ))}
            {!submitted && (
              <button
                type="button"
                onClick={handleFormSubmit}
                className="w-full rounded-lg bg-acc px-3 py-2 text-sm font-semibold text-bg hover:bg-acc/90 transition-colors cursor-pointer"
              >
                Enviar
              </button>
            )}
            {submitted && (
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <Check size={14} weight="bold" />
                <span>Enviado com sucesso</span>
              </div>
            )}
          </div>
        </div>
      );

    case "progress":
      const pct = widget.max ? Math.min(100, Math.round(((widget.progress ?? 0) / widget.max) * 100)) : (widget.progress ?? 0);
      return (
        <div className={baseClasses}>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="font-display text-sm font-semibold text-txt">{widget.title}</h4>
              <span className="text-xs font-mono text-mut">{widget.progressLabel ?? `${pct}%`}</span>
            </div>
            {widget.description && <p className="text-xs text-mut mb-2">{widget.description}</p>}
            <div className="h-2 w-full rounded-full bg-surf2 overflow-hidden">
              <div
                className="h-full rounded-full bg-acc transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      );

    case "card":
      return (
        <div className={baseClasses}>
          {widget.imageUrl && (
            <div className="h-32 w-full bg-surf2 overflow-hidden">
              <img src={widget.imageUrl} alt={widget.title} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="px-4 py-3">
            <h4 className="font-display text-sm font-semibold text-txt">{widget.title}</h4>
            {widget.description && <p className="text-xs text-mut mt-1 leading-relaxed">{widget.description}</p>}
            {widget.footer && <p className="text-[11px] text-mut/60 mt-2">{widget.footer}</p>}
          </div>
          {widget.actions && widget.actions.length > 0 && (
            <div className="px-3 pb-3 flex flex-wrap gap-2 border-t border-bd pt-2">
              {widget.actions.map((action) => {
                const Icon = action.icon ? ICON_MAP[action.icon] : undefined;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleAction(action.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      STYLE_CLASSES[action.style ?? "secondary"]
                    }`}
                  >
                    {Icon && <Icon size={12} weight="bold" />}
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
}