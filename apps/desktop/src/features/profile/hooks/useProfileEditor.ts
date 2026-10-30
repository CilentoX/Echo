import { useCallback, useState } from "react";
import { useProfileStore } from "@/stores/profileStore";
import { matrixService } from "@/lib/matrix/instance";

export interface ProfileEditorState {
  isEditing: boolean;
  editDisplayName: string;
  editNickname: string;
  editBio: string;
  editAvatarUrl: string | null;
  editBannerUrl: string | null;
  isSaving: boolean;
  error: string | null;
}

export interface ProfileEditorActions {
  startEditing: () => void;
  cancelEditing: () => void;
  setEditDisplayName: (name: string) => void;
  setEditNickname: (nickname: string) => void;
  setEditBio: (bio: string) => void;
  setEditAvatarUrl: (url: string | null) => void;
  setEditBannerUrl: (url: string | null) => void;
  saveChanges: () => Promise<void>;
}

export function useProfileEditor(): ProfileEditorState & ProfileEditorActions {
  const {
    displayName,
    nickname,
    bio,
    avatarUrl,
    bannerUrl,
    appwriteAvatarUrl,
    appwriteBannerUrl,
    setDisplayName,
    setNickname,
    setBio,
    setAvatarUrl,
    setBannerUrl,
  } = useProfileStore();

  const [state, setState] = useState<ProfileEditorState>({
    isEditing: false,
    editDisplayName: displayName,
    editNickname: nickname ?? "",
    editBio: bio ?? "",
    editAvatarUrl: appwriteAvatarUrl ?? avatarUrl,
    editBannerUrl: appwriteBannerUrl ?? bannerUrl,
    isSaving: false,
    error: null,
  });

  const startEditing = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isEditing: true,
      editDisplayName: displayName,
      editNickname: nickname ?? "",
      editBio: bio ?? "",
      editAvatarUrl: appwriteAvatarUrl ?? avatarUrl,
      editBannerUrl: appwriteBannerUrl ?? bannerUrl,
      error: null,
    }));
  }, [displayName, nickname, bio, avatarUrl, bannerUrl, appwriteAvatarUrl, appwriteBannerUrl]);

  const cancelEditing = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isEditing: false,
      editDisplayName: displayName,
      editNickname: nickname ?? "",
      editBio: bio ?? "",
      editAvatarUrl: appwriteAvatarUrl ?? avatarUrl,
      editBannerUrl: appwriteBannerUrl ?? bannerUrl,
      error: null,
    }));
  }, [displayName, nickname, bio, avatarUrl, bannerUrl, appwriteAvatarUrl, appwriteBannerUrl]);

  const setEditDisplayName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, editDisplayName: name }));
  }, []);

  const setEditNickname = useCallback((nickname: string) => {
    setState((prev) => ({ ...prev, editNickname: nickname }));
  }, []);

  const setEditBio = useCallback((bio: string) => {
    setState((prev) => ({ ...prev, editBio: bio }));
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
      if (state.editDisplayName !== displayName) {
        await matrixService.setDisplayName(state.editDisplayName);
        setDisplayName(state.editDisplayName);
      }

      if (state.editNickname !== nickname) {
        setNickname(state.editNickname || null);
      }

      if (state.editBio !== bio) {
        await matrixService.patchGlobalProfile(userId, {
          bio: state.editBio || null,
        });
        setBio(state.editBio || null);
      }

      // Avatar e banner já foram sincronizados via useImageUploadWithMatrix
      // Aqui apenas atualizamos o store local e Profile API se necessário
      if (state.editAvatarUrl !== avatarUrl) {
        await matrixService.patchGlobalProfile(userId, {
          avatarUrl: state.editAvatarUrl,
        });
        setAvatarUrl(state.editAvatarUrl);
      }

      if (state.editBannerUrl !== bannerUrl) {
        await matrixService.patchGlobalProfile(userId, {
          bannerUrl: state.editBannerUrl,
        });
        setBannerUrl(state.editBannerUrl);
      }

      setState((prev) => ({ ...prev, isEditing: false, isSaving: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: "Não foi possível salvar as alterações. Tente novamente.",
      }));
    }
  }, [
    state.editDisplayName,
    state.editNickname,
    state.editBio,
    state.editAvatarUrl,
    state.editBannerUrl,
    displayName,
    nickname,
    bio,
    avatarUrl,
    bannerUrl,
    matrixService,
    setDisplayName,
    setNickname,
    setBio,
    setAvatarUrl,
    setBannerUrl,
  ]);

  return {
    ...state,
    startEditing,
    cancelEditing,
    setEditDisplayName,
    setEditNickname,
    setEditBio,
    setEditAvatarUrl,
    setEditBannerUrl,
    saveChanges,
  };
}