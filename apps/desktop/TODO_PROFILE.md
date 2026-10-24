# Tarefas: Melhorar tela de perfil + corrigir dropdown

## 1. Criar MemberDropdownContent.tsx (novo)
- Componente do conteúdo do dropdown (avatar, nome, ID, status, ações, bio)
- Usar shadcn/ui: Card, Button, Separator, Label
- Receber userId + onClose
- Buscar dados via matrixService.getDisplayName/getAvatarUrl + uiStore presence

## 2. Reescrever MemberList.tsx
- Envolver cada botão de membro com Popover + PopoverTrigger + PopoverContent
- Remover posicionamento manual (top/left via getBoundingClientRect)
- Remover useEffect de clique fora (Popover trata isso)
- Dropdown fecha ao clicar fora automaticamente

## 3. Reescrever Profile.tsx
- Usar Dialog (shadcn/ui) em vez de fixed inset-0 manual
- Usar Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription
- Usar Tabs, TabsList, TabsTrigger, TabsContent para abas
- Usar Button, Input, Label, Textarea, Separator
- Manter ImageUploadWithCrop + MxcImage existentes
- Simplificar estados de rascunho (usar profileStore diretamente)

## 4. Verificação
- tsc --noEmit (0 erros)
- vitest para Profile.test.tsx e service.test.ts