import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import Profile from "./Profile";
import { useProfileStore } from "@/stores/profileStore";
import { matrixService } from "@/lib/matrix/instance";
import { uploadImage } from "@/lib/appwrite/storage";

vi.mock("@/lib/matrix/instance", () => ({
  matrixService: {
    uploadMedia: vi.fn(),
    setAvatarUrl: vi.fn(),
    setUserBanner: vi.fn(),
    setDisplayName: vi.fn(),
    getUserId: vi.fn(() => "@test:echo.litteris.online"),
  },
}));

vi.mock("@/lib/appwrite/storage", () => ({
  uploadImage: vi.fn(),
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, value, onValueChange, defaultValue, ...props }: any) => {
    const activeValue = value ?? defaultValue ?? "profile";
    const tabContents = Array.isArray(children) ? children : [children];
    const activeContent = tabContents.find(
      (child) => child?.props?.value === activeValue
    );
    return (
      <div data-testid="tabs" {...props}>
        {activeContent}
      </div>
    );
  },
  TabsList: ({ children, ...props }: any) => <div data-testid="tabs-list" role="tablist" {...props}>{children}</div>,
  TabsTrigger: ({ children, value, disabled, ...props }: any) => (
    <button role="tab" data-value={value} aria-selected={false} disabled={disabled} onClick={() => props.onValueChange?.(value)} {...props}>{children}</button>
  ),
  TabsContent: ({ children, value, ...props }: any) => <div data-testid="tabs-content" role="tabpanel" data-value={value} {...props}>{children}</div>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open, onOpenChange: _onOpenChange }: any) => open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children, ...props }: any) => <div data-testid="sheet-content" {...props}>{children}</div>,
  SheetHeader: ({ children, ...props }: any) => <div data-testid="sheet-header" {...props}>{children}</div>,
  SheetTitle: ({ children, ...props }: any) => <div data-testid="sheet-title" {...props}>{children}</div>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, ...props }: any) => <div data-testid="scroll-area" {...props}>{children}</div>,
}));

vi.mock("@/components/media/ImageUploadWithEdit", () => {
  const MockImageUploadWithEdit = ({
    value,
    onChange,
    onRemove,
    disabled,
    placeholder,
    appwriteUrl,
    ...props
  }: any) => {
    const hasImage = value || appwriteUrl;
    return (
      <div data-testid="image-upload" {...props}>
        {hasImage ? (
          <div data-testid="image-preview">
            <span data-testid="image-src">{appwriteUrl || value}</span>
            {!disabled && <button data-testid="change-image">Alterar imagem</button>}
            {onRemove && <button data-testid="remove-image" onClick={onRemove}>Remover</button>}
          </div>
        ) : (
          <button
            data-testid="add-image"
            onClick={() => {
              const file = new File(["test"], "test.png", { type: "image/png" });
              onChange(file);
            }}
            disabled={disabled}
          >
            {placeholder || "Adicionar imagem"}
          </button>
        )}
      </div>
    );
  };
  return {
    __esModule: true,
    default: MockImageUploadWithEdit,
  };
});

const mockUploadMedia = vi.mocked(matrixService.uploadMedia);
const mockSetAvatarUrl = vi.mocked(matrixService.setAvatarUrl);
const mockSetUserBanner = vi.mocked(matrixService.setUserBanner);
const mockSetDisplayName = vi.mocked(matrixService.setDisplayName);
const mockGetUserId = vi.mocked(matrixService.getUserId);
const mockUploadImage = vi.mocked(uploadImage);

const defaultProps = { open: true, onClose: vi.fn() };

function resetStore() {
  useProfileStore.setState({
    displayName: "Lucas",
    username: "@lucas:echo.litteris.online",
    nickname: "lucas",
    avatarUrl: null,
    bannerUrl: null,
    appwriteAvatarUrl: null,
    appwriteBannerUrl: null,
    bio: "Dev",
    role: "Membro",
    joinedAt: "2026-01-01",
    links: [],
    setDisplayName: vi.fn(),
    setNickname: vi.fn(),
    setBio: vi.fn(),
    setRole: vi.fn(),
    setAvatarUrl: vi.fn(),
    setBannerUrl: vi.fn(),
    setAppwriteAvatarUrl: vi.fn(),
    setAppwriteBannerUrl: vi.fn(),
    setLinks: vi.fn(),
  });
  mockUploadMedia.mockResolvedValue("mxc://hs/file");
  mockSetAvatarUrl.mockResolvedValue(undefined);
  mockSetUserBanner.mockResolvedValue(undefined);
  mockSetDisplayName.mockResolvedValue(undefined);
  mockGetUserId.mockReturnValue("@test:echo.litteris.online");
  mockUploadImage.mockResolvedValue("https://appwrite.example.com/file.png");
  vi.clearAllMocks();
}

function renderProfile(props = {}) {
  return render(
    <TooltipProvider>
      <Profile {...defaultProps} {...props} />
    </TooltipProvider>
  );
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Profile", () => {
  it("não renderiza quando fechado", () => {
    const { container } = renderProfile({ open: false });
    expect(container.children.length).toBe(0);
  });

  it("exibe iniciais quando não há avatar", () => {
    resetStore();
    renderProfile();
    // O avatar grande mostra as iniciais
    expect(screen.getByText("L")).not.toBeNull();
    expect(screen.getAllByText("Lucas")).toHaveLength(2);
  });

  it("exibe nickname com @ quando definido", () => {
    resetStore();
    renderProfile();
    expect(screen.getAllByText("@lucas")).toHaveLength(2);
  });

  it("exibe bio e cargo", () => {
    resetStore();
    renderProfile();
    expect(screen.getByText("Dev")).not.toBeNull();
    expect(screen.getAllByText("Membro").length).toBeGreaterThanOrEqual(1);
  });

  it("exibe botão Editar perfil quando não está editando", () => {
    resetStore();
    renderProfile();
    expect(screen.getByRole("button", { name: /Editar perfil/ })).not.toBeNull();
  });

  it("mostra campos de edição ao clicar em Editar perfil", async () => {
    resetStore();
    renderProfile();
    fireEvent.click(screen.getByRole("button", { name: /Editar perfil/ }));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Seu apelido")).not.toBeNull();
      expect(screen.getByPlaceholderText("Conte um pouco sobre você…")).not.toBeNull();
      expect(screen.getByRole("button", { name: /Salvar alterações/ })).not.toBeNull();
    });
  });

  it("mostra o texto Alterar imagem quando edita banner", async () => {
    resetStore();
    useProfileStore.setState({ appwriteBannerUrl: "https://appwrite.example.com/banner.png" });
    renderProfile();
    fireEvent.click(screen.getByRole("button", { name: /Editar perfil/ }));
    
    await waitFor(() => {
      expect(screen.getByText("Alterar imagem")).not.toBeNull();
    });
  });

  it("chama uploadImage ao fazer upload de imagem", async () => {
    resetStore();
    renderProfile();
    fireEvent.click(screen.getByRole("button", { name: /Editar perfil/ }));
    
    const addImageBtns = screen.getAllByTestId("add-image");
    fireEvent.click(addImageBtns[0]);
    
    await waitFor(() => {
      expect(mockUploadImage).toHaveBeenCalled();
    });
  });

  it("fecha ao pressionar Esc", () => {
    resetStore();
    renderProfile();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("renderiza sidebar com abas de navegação", () => {
    resetStore();
    renderProfile();
    expect(screen.getByText("Perfil")).not.toBeNull();
    expect(screen.getByText("Aparência")).not.toBeNull();
    expect(screen.getByText("Notificações")).not.toBeNull();
    expect(screen.getByText("Privacidade")).not.toBeNull();
    expect(screen.getByText("Conexões")).not.toBeNull();
    expect(screen.getByText("Segurança")).not.toBeNull();
  });

  it("exibe preview do usuário na sidebar", () => {
    resetStore();
    renderProfile();
    // Sidebar preview shows user info
    expect(screen.getByText("Lucas")).not.toBeNull();
    expect(screen.getByText("@lucas")).not.toBeNull();
  });
});