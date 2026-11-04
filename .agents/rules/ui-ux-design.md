# UI/UX & Design Guidelines for Echo

- **Discord layout ergonomics:** Rail (72px) -> Sidebar (232px) -> Content (Flex) -> Live Right Pane (320px) -> UserBar Dock (72px).
- **Unique Echo visual identity:** Dark glassmorphism, `#0FB9A8` accents, subtle translucent borders (`border-white/[0.04]` to `border-white/[0.08]`), tactile active scales (`active:scale-[0.98]`).
- **Two-column Friends Dashboard:** Main list on left, "Active Now & Community" panel on right to avoid empty void.
- **Clear Home division:** "Amigos", "Descobrir", and "Mensagens Diretas".
- **Modal & Dialog Design Standard (Guild Modal Standard):**
  - Container: `bg-[#12161f] border-white/[0.08] rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 max-h-[90vh] overflow-y-auto scrollbar-thin`.
  - Header: Icon badge `w-10 h-10 rounded-2xl bg-acc text-bg`, title + subtitle, top-right `X` close button.
  - Hero Preview: 16:9 banner with floating avatar (`-mt-9`) displaying live dynamic initials updating as the user types.
  - Inputs: Translucent `bg-white/[0.03] border-white/[0.08] rounded-xl focus:border-acc/50 focus:ring-1 focus:ring-acc/30 hover:border-white/[0.15]` with uppercase tracking labels and character counter.
  - Buttons: Cancel outline + primary accent with tactile scale `active:scale-95` and loading spinner.
