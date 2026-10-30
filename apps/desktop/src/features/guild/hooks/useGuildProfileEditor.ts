import { useCallback, useState } from "react";
import { useGuildProfileStore } from "@/stores/guildProfileStore";
import { matrixService } from "@/lib/matrix/instance";

export interface GuildProfileEditorState {
  isEditing: boolean;
  editName: string;
  editDescription: string;
  editAvatarUrl: string | null;
  editBannerUrl: string | null;
  isSaving: boolean;
  error: string | null;
}

export interface GuildProfileEditorActions {
  startEditing: () => void;
  cancelEditing: () => void;
  setEditName: (name: string) => void;
  setEditDescription: (description: string) => void;
  setEditAvatarUrl: (url: string | null) => void;
  setEditBannerUrl: (url: string | null) => void;
  saveChanges: () => Promise<void>;
}

export function useGuildProfileEditor(
  guildId: string,
  currentProfile: { name: string; description: string | null; avatarUrl: string | null; bannerUrl: string | null }
): GuildProfileEditorState & GuildProfileEditorActions {
  const { setGuildProfile } = useGuildProfileStore();

  const [state, setState] = useState<GuildProfileEditorState>({
    isEditing: false,
    editName: currentProfile.name,
    editDescription: currentProfile.description ?? "",
    editAvatarUrl: currentProfile.avatarUrl,
    editBannerUrl: currentProfile.bannerUrl,
    isSaving: false,
    error: null,
  });

  const startEditing = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isEditing: true,
      editName: currentProfile.name,
      editDescription: currentProfile.description ?? "",
      editAvatarUrl: currentProfile.avatarUrl,
      editBannerUrl: currentProfile.bannerUrl,
      error: null,
    }));
  }, [currentProfile]);

  const cancelEditing = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isEditing: false,
      editName: currentProfile.name,
      editDescription: currentProfile.description ?? "",
      editAvatarUrl: currentProfile.avatarUrl,
      editBannerUrl: currentProfile.bannerUrl,
      error: null,
    }));
  }, [currentProfile]);

  const setEditName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, editName: name }));
  }, []);

  const setEditDescription = useCallback((description: string) => {
    setState((prev) => ({ ...prev, editDescription: description }));
  }, []);

  const setEditAvatarUrl = useCallback((url: string | null) => {
    setState((prev) => ({ ...prev, editAvatarUrl: url }));
  }, []);

  const setEditBannerUrl = useCallback((url: string | null) => {
    setState((prev) => ({ ...prev, editBannerUrl: url }));
  }, []);

  const saveChanges = useCallback(async () => {
    setState((prev) => ({ ...prev, isSaving: true, error: null }));

    const userId = matrixService.getUserId();
    if (!userId) {
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: "Usuário não autenticado.",
      }));
      return;
    }

    try {
      await matrixService.upsertGuildProfile(guildId, {
        name: state.editName,
        description: state.editDescription || null,
        avatarUrl: state.editAvatarUrl,
        bannerUrl: state.editBannerUrl,
        createdBy: userId,
      });

      setGuildProfile({
        name: state.editName,
        description: state.editDescription || null,
        avatarUrl: state.editAvatarUrl,
        bannerUrl: state.editBannerUrl,
      });

      setState((prev) => ({ ...prev, isEditing: false, isSaving: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: "Não foi possível salvar as alterações da guilda. Tente novamente.",
      }));
    }
  }, [
    guildId,
    state.editName,
    state.editDescription,
    state.editAvatarUrl,
    state.editBannerUrl,
    currentProfile,
    matrixService,
    setGuildProfile,
  ]);

  return {
    ...state,
    startEditing,
    cancelEditing,
    setEditName,
    setEditDescription,
    setEditAvatarUrl,
    setEditBannerUrl,
    saveChanges,
  };
}
