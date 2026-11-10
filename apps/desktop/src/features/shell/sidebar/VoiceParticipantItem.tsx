import { DotsSixVertical, Television } from "@phosphor-icons/react";
import MxcImage from "@/components/media/MxcImage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import MemberContextMenu from "../MemberContextMenu";
import MemberDropdownContent from "../MemberDropdownContent";

export interface VoiceParticipantData {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  isMuted?: boolean;
  isDeafened?: boolean;
  isSpeaking?: boolean;
  isScreenSharing?: boolean;
  volume?: number;
}

interface VoiceParticipantItemProps {
  participant: VoiceParticipantData;
  channelId: string;
  connected: boolean;
  guildProfiles?: Record<string, any>;
  myUserId?: string | null;
  myAppwriteAvatarUrl?: string | null;
  profileAvatarUrl?: string | null;
  microphoneEnabled?: boolean;
  headphonesEnabled?: boolean;
  activeVoiceChannelId?: string | null;
  speakingMembers?: string[];
  isSpeaking?: boolean;
  isVoiceConnected?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VoiceParticipantItem({
  participant,
  channelId,
  connected,
  guildProfiles,
  myUserId,
  myAppwriteAvatarUrl,
  profileAvatarUrl,
  microphoneEnabled = true,
  headphonesEnabled = true,
  activeVoiceChannelId,
  speakingMembers = [],
  isSpeaking = false,
  isVoiceConnected = false,
  isOpen,
  onOpenChange,
}: VoiceParticipantItemProps) {
  const isMe =
    participant.userId === "me" ||
    participant.userId === myUserId ||
    (myUserId ? participant.userId === myUserId : false);
  const effectiveUserId = participant.userId === "me" ? (myUserId || "") : participant.userId;
  const effectiveNick = guildProfiles?.[effectiveUserId]?.nickname || participant.username;
  const effectiveAvatar =
    participant.avatarUrl ||
    guildProfiles?.[effectiveUserId]?.avatarUrl ||
    (isMe ? (myAppwriteAvatarUrl || profileAvatarUrl) : null);
  const isParticipantMuted = Boolean(
    participant.isMuted ||
    participant.isDeafened ||
    (isMe && (!microphoneEnabled || !headphonesEnabled))
  );
  const isThisActiveVoiceChannel = channelId === activeVoiceChannelId;
  const participantSpeaking =
    isThisActiveVoiceChannel &&
    !isParticipantMuted &&
    (participant.isSpeaking ||
      speakingMembers.includes(participant.userId) ||
      (isMe &&
        connected &&
        isVoiceConnected &&
        (isSpeaking ||
          speakingMembers.includes("me") ||
          (effectiveUserId ? speakingMembers.includes(effectiveUserId) : false))));

  return (
    <MemberContextMenu
      userId={effectiveUserId || participant.userId}
      displayName={effectiveNick}
      avatarUrl={effectiveAvatar}
      onOpenProfile={() => onOpenChange(true)}
    >
      <li
        className="relative cursor-grab active:cursor-grabbing"
        draggable={true}
        onDragStart={(e) => {
          e.stopPropagation();
          const payload = JSON.stringify({
            userId: effectiveUserId || participant.userId || "me",
            username: effectiveNick,
            isMe,
          });
          e.dataTransfer.setData("application/x-echo-voice-member", payload);
          e.dataTransfer.setData("text/plain", effectiveUserId || participant.userId || "me");
          e.dataTransfer.effectAllowed = "move";
          (window as any).__ECHO_ACTIVE_DRAG__ = {
            type: "voice-member",
            id: effectiveUserId || participant.userId || "me",
            data: { userId: effectiveUserId || participant.userId || "me", username: effectiveNick, isMe },
          };
        }}
        onDragEnd={() => {
          (window as any).__ECHO_ACTIVE_DRAG__ = null;
        }}
      >
        <Popover
          open={isOpen}
          onOpenChange={onOpenChange}
        >
          <PopoverTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenChange(!isOpen);
                }
              }}
              aria-label={`Perfil de ${effectiveNick}`}
              className={`cursor-pointer flex w-full items-center gap-1.5 py-1 px-2 rounded-xl text-xs transition-all active:scale-[0.98] group ${
                isOpen
                  ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt"
                  : participantSpeaking
                    ? "bg-online/10 text-online border border-online/20"
                    : "text-mut dark:hover:bg-white/[0.04] hover:bg-black/[0.04] hover:text-txt"
              }`}
            >
              <DotsSixVertical
                size={11}
                className="opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing text-mut shrink-0 -ml-1 mr-0.5"
              />
              <div className="relative h-5 w-5 shrink-0">
                {effectiveAvatar ? (
                  <MxcImage
                    mxcUrl={effectiveAvatar}
                    alt={effectiveNick}
                    className={`h-5 w-5 rounded-full object-cover transition-all ${
                      participantSpeaking
                        ? "ring-2 ring-online shadow-sm shadow-online/60 animate-pulse"
                        : "ring-1 ring-bd-subtle group-hover:ring-acc/40"
                    }`}
                    width={20}
                    height={20}
                  />
                ) : (
                  <div
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold bg-acc text-bg shadow-sm transition-all ${
                      participantSpeaking
                        ? "ring-2 ring-online shadow-sm shadow-online/60 animate-pulse"
                        : "ring-1 ring-bd-subtle group-hover:ring-acc/40"
                    }`}
                  >
                    {effectiveNick.charAt(0).toUpperCase()}
                  </div>
                )}
                {participant.isMuted && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-err ring-1 ring-surf"
                    title="Mutado"
                  />
                )}
              </div>

              <span
                className={`text-[11px] truncate flex-1 text-left ${
                  participantSpeaking ? "text-online font-semibold" : "text-txt/90"
                }`}
              >
                {effectiveNick}
              </span>

              {/* Badge de Live/Transmissão de Tela */}
              {participant.isScreenSharing && (
                <span
                  className="flex items-center gap-0.5 rounded bg-err/15 px-1.5 py-0.5 text-[9px] font-bold text-err shrink-0 tracking-wider shadow-xs animate-pulse"
                  title="Transmitindo tela"
                >
                  <Television size={10} weight="fill" />
                  AO VIVO
                </span>
              )}

              {/* Equalizer Waveform quando Falando */}
              {participantSpeaking && (
                <div className="flex items-center gap-0.5 shrink-0" title="Falando...">
                  <span className="h-2 w-0.5 rounded-full bg-online animate-[pulse_0.6s_ease-in-out_infinite]" />
                  <span className="h-3 w-0.5 rounded-full bg-online animate-[pulse_0.4s_ease-in-out_infinite_150ms]" />
                  <span className="h-1.5 w-0.5 rounded-full bg-online animate-[pulse_0.5s_ease-in-out_infinite_300ms]" />
                </div>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            collisionPadding={16}
            className="w-auto p-0 border-0 bg-transparent shadow-none max-w-none outline-none z-50"
          >
            <MemberDropdownContent
              userId={effectiveUserId || (myUserId ?? "")}
              initialDisplayName={effectiveNick}
              initialAvatarUrl={effectiveAvatar}
              onClose={() => onOpenChange(false)}
            />
          </PopoverContent>
        </Popover>
      </li>
    </MemberContextMenu>
  );
}

