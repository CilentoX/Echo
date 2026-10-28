import { useState, useCallback } from "react";
import { PROFILE_TABS, type TabKey } from "../constants";

export function useProfileTabs(initialTab: TabKey = "profile") {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const changeTab = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  const tabs = PROFILE_TABS;

  return {
    activeTab,
    setActiveTab: changeTab,
    tabs,
  };
}