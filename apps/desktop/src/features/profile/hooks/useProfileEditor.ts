import { useCallback, useRef, useState } from "react";
import { useProfileStore } from "@/stores/profileStore";
import { matrixService } from "@/lib/matrix/instance";
import { useEchoApi } from "@/lib/api/echoApi";

export interface ProfileEditorState {
  isEditing: boolean;
  editDisplayName: string;
  editUsername: string;
  editNickname: string;
  editBio: string;
  editAvatarUrl: string | null;
  editBannerUrl: string | null;
  editLinks: Array<{ label: string; url: string }>;
  isSaving: boolean;
  error: string | null;
  usernameStatus: {
    checking: boolean;
    available: boolean | null;
    error: string | null;
  };
}

export interface ProfileEditorActions {
  startEditing: () => void;
  cancelEditing: () => void;
  setEditDisplayName: (name: string) => void;
  setEditUsername: (username: string) => void;
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
    username,
    nickname,
    bio,
    avatarUrl,
    bannerUrl,
    appwriteAvatarUrl,
    appwriteBannerUrl,
    links,
    setDisplayName,
    setUsername,
    setNickname,
    setBio,
    setAvatarUrl,
    setBannerUrl,
    setLinks,
  } = useProfileStore();

  const echoApi = useEchoApi();
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<ProfileEditorState>({
    isEditing: false,
    editDisplayName: displayName,
    editUsername: username || "",
    editNickname: nickname ?? "",
    editBio: bio ?? "",
    editAvatarUrl: appwriteAvatarUrl ?? avatarUrl,
    editBannerUrl: appwriteBannerUrl ?? bannerUrl,
    editLinks: links ? [...links] : [],
    isSaving: false,
    error: null,
    usernameStatus: {
      checking: false,
      available: null,
      error: null,
    },
  });

  const startEditing = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isEditing: true,
      editDisplayName: displayName,
      editUsername: username || "",
      editNickname: nickname ?? "",
      editBio: bio ?? "",
      editAvatarUrl: appwriteAvatarUrl ?? avatarUrl,
      editBannerUrl: appwriteBannerUrl ?? bannerUrl,
      editLinks: links ? [...links] : [],
      error: null,
      usernameStatus: {
        checking: false,
        available: true,
        error: null,
      },
    }));
  }, [displayName, username, nickname, bio, avatarUrl, bannerUrl, appwriteAvatarUrl, appwriteBannerUrl, links]);

  const cancelEditing = useCallback(() => {
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }
    setState((prev) => ({
      ...prev,
      isEditing: false,
      editDisplayName: displayName,
      editUsername: username || "",
      editNickname: nickname ?? "",
      editBio: bio ?? "",
      editAvatarUrl: appwriteAvatarUrl ?? avatarUrl,
      editBannerUrl: appwriteBannerUrl ?? bannerUrl,
      editLinks: links ? [...links] : [],
      error: null,
      usernameStatus: {
        checking: false,
        available: null,
        error: null,
      },
    }));
  }, [displayName, username, nickname, bio, avatarUrl, bannerUrl, appwriteAvatarUrl, appwriteBannerUrl, links]);

  const setEditDisplayName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, editDisplayName: name }));
  }, []);

  const setEditUsername = useCallback(
    (rawUsername: string) => {
      // Normaliza para lowercase sem espaços nem @
      const clean = rawUsername.toLowerCase().replace(/^@/, "").trim();
      setState((prev) => ({
        ...prev,
        editUsername: clean,
        usernameStatus: {
          checking: false,
          available: null,
          error: null,
        },
      }));

      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }

      if (!clean) {
        setState((prev) => ({
          ...prev,
          usernameStatus: {
            checking: false,
            available: false,
            error: "O nome de usuário não pode ficar vazio.",
          },
        }));
        return;
      }

      const USERNAME_REGEX = /^[a-z0-9_.-]{3,32}$/;
      if (!USERNAME_REGEX.test(clean)) {
        setState((prev) => ({
          ...prev,
          usernameStatus: {
            checking: false,
            available: false,
            error: "Username deve ter 3-32 caracteres (apenas letras minúsculas, números, '.', '_' ou '-').",
          },
        }));
        return;
      }

      // Se for idêntico ao username atual do usuário, já está válido
      if (clean === username?.toLowerCase()) {
        setState((prev) => ({
          ...prev,
          usernameStatus: {
            checking: false,
            available: true,
            error: null,
          },
        }));
        return;
      }

      // Agenda verificação com debounce
      setState((prev) => ({
        ...prev,
        usernameStatus: {
          checking: true,
          available: null,
          error: null,
        },
      }));

      checkTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await echoApi.checkUsername(clean);
          setState((prev) => {
            // Garante que ainda corresponde ao valor atual digitado
            if (prev.editUsername !== clean) return prev;
            return {
              ...prev,
              usernameStatus: {
                checking: false,
                available: res.available,
                error: res.available ? null : (res.error || "Nome de usuário já está em uso."),
              },
            };
          });
        } catch {
          setState((prev) => ({
            ...prev,
            usernameStatus: {
              checking: false,
              available: null,
              error: "Não foi possível verificar a disponibilidade no momento.",
            },
          }));
        }
      }, 400);
    },
    [username, echoApi]
  );

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

    // Valida username antes de salvar
    const cleanUsername = state.editUsername.toLowerCase().trim();
    const USERNAME_REGEX = /^[a-z0-9_.-]{3,32}$/;
    if (!USERNAME_REGEX.test(cleanUsername)) {
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: "Username inválido. Use de 3 a 32 caracteres (apenas letras minúsculas, números, '.', '_' ou '-').",
      }));
      return;
    }

    if (state.usernameStatus.available === false) {
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: state.usernameStatus.error || "O nome de usuário escolhido não está disponível.",
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
          username: cleanUsername,
          nickname: state.editDisplayName, // Apelido / Display name
          bio: state.editBio || null,
          avatarUrl: state.editAvatarUrl,
          bannerUrl: state.editBannerUrl,
          links: state.editLinks,
        });
      } else if (typeof matrixService.patchGlobalProfile === "function") {
        await matrixService.patchGlobalProfile({
          nickname: state.editDisplayName,
          bio: state.editBio || null,
          avatarUrl: state.editAvatarUrl,
          bannerUrl: state.editBannerUrl,
        });
      }

      setDisplayName(state.editDisplayName);
      setUsername(cleanUsername);
      setNickname(state.editDisplayName);
      setBio(state.editBio || null);
      setAvatarUrl(state.editAvatarUrl);
      setBannerUrl(state.editBannerUrl);
      setLinks(state.editLinks);
      useProfileStore.getState().setAppwriteAvatarUrl(state.editAvatarUrl);
      useProfileStore.getState().setAppwriteBannerUrl(state.editBannerUrl);

      setState((prev) => ({ ...prev, isEditing: false, isSaving: false }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível salvar as alterações. Tente novamente.";
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: msg,
      }));
    }
  }, [
    state.editDisplayName,
    state.editUsername,
    state.usernameStatus,
    state.editBio,
    state.editAvatarUrl,
    state.editBannerUrl,
    state.editLinks,
    displayName,
    matrixService,
    setDisplayName,
    setUsername,
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
    setEditUsername,
    setEditNickname,
    setEditBio,
    setEditAvatarUrl,
    setEditBannerUrl,
    addEditLink,
    removeEditLink,
    saveChanges,
  };
}