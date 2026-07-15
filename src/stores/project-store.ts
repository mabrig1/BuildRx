import { create } from "zustand";

import type { Project } from "@/types";

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  isLoading: boolean;
  setProjects: (projects: Project[]) => void;
  setActiveProject: (id: string | null) => void;
  upsertProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  activeProjectId: null,
  isLoading: false,
  setProjects: (projects) => set({ projects }),
  setActiveProject: (id) => set({ activeProjectId: id }),
  upsertProject: (project) =>
    set((state) => {
      const exists = state.projects.some((p) => p.id === project.id);
      return {
        projects: exists
          ? state.projects.map((p) => (p.id === project.id ? project : p))
          : [project, ...state.projects],
      };
    }),
  removeProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId:
        state.activeProjectId === id ? null : state.activeProjectId,
    })),
  setLoading: (loading) => set({ isLoading: loading }),
}));
