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
  editLinks: Array<{ label: string; url: string }>;
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
  addEditLink: (label: string, url: string) => void;
  removeEditLink: (index: number) => void;
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
    links,
    setDisplayName,
    setNickname,
    setBio,
    setAvatarUrl,
    setBannerUrl,
    setLinks,
  } = useProfileStore();

  const [state, setState] = useState<ProfileEditorState>({
    isEditing: false,
    editDisplayName: displayName,
    editNickname: nickname ?? "",
    editBio: bio ?? "",
    editAvatarUrl: appwriteAvatarUrl ?? avatarUrl,
    editBannerUrl: appwriteBannerUrl ?? bannerUrl,
    editLinks: links ? [...links] : [],
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
      editLinks: links ? [...links] : [],
      error: null,
    }));
  }, [displayName, nickname, bio, avatarUrl, bannerUrl, appwriteAvatarUrl, appwriteBannerUrl, links]);

  const cancelEditing = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isEditing: false,
      editDisplayName: displayName,
      editNickname: nickname ?? "",
      editBio: bio ?? "",
      editAvatarUrl: appwriteAvatarUrl ?? avatarUrl,
      editBannerUrl: appwriteBannerUrl ?? bannerUrl,
      editLinks: links ? [...links] : [],
      error: null,
    }));
  }, [displayName, nickname, bio, avatarUrl, bannerUrl, appwriteAvatarUrl, appwriteBannerUrl, links]);

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

  const addEditLink = useCallback((label: string, url: string) => {
    setState((prev) => ({
      ...prev,
      editLinks: [...prev.editLinks, { label, url }],
    }));
  }, []);

  const removeEditLink = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      editLinks: prev.editLinks.filter((_, i) => i !== index),
    }));
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
      if (state.editDisplayName !== displayName && typeof matrixService.setDisplayName === "function") {
        await matrixService.setDisplayName(state.editDisplayName);
      }

      if (typeof matrixService.patchUserProfile === "function") {
        await matrixService.patchUserProfile("", {
          displayName: state.editDisplayName,
          nickname: state.editNickname || null,
          bio: state.editBio || null,
          avatarUrl: state.editAvatarUrl,
          bannerUrl: state.editBannerUrl,
          links: state.editLinks,
        });
      } else if (typeof matrixService.patchGlobalProfile === "function") {
        await matrixService.patchGlobalProfile({
          nickname: state.editNickname || null,
          bio: state.editBio || null,
          avatarUrl: state.editAvatarUrl,
          bannerUrl: state.editBannerUrl,
        });
      }

      setDisplayName(state.editDisplayName);
      setNickname(state.editNickname || null);
      setBio(state.editBio || null);
      setAvatarUrl(state.editAvatarUrl);
      setBannerUrl(state.editBannerUrl);
      setLinks(state.editLinks);
      useProfileStore.getState().setAppwriteAvatarUrl(state.editAvatarUrl);
      useProfileStore.getState().setAppwriteBannerUrl(state.editBannerUrl);

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
    state.editLinks,
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
    setLinks,
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
    addEditLink,
    removeEditLink,
    saveChanges,
  };
}