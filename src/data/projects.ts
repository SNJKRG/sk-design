import data from './projects.generated.json';

export type ImageSource = { src: string; w: number };
export type ImageSet = {
  width: number;
  height: number;
  sources: { avif?: ImageSource[]; webp: ImageSource[] };
};
export type CaseMedia = ImageSet & { caption: string; tall: boolean };
export type Project = {
  id: string;
  index: number;
  slug: string;
  route: string;
  title: string;
  shortTitle: string;
  category: string;
  industry: string;
  type: string;
  summary: string;
  description: string;
  url: string;
  status: string;
  designCredit: string | null;
  cover: ImageSet;
  media: CaseMedia[];
};

export const BRAND: string = data.brand;
export const CONTACT: { label: string; href: string; handle: string } = data.contact;
export const LOGO_SIZE = data.logo;
export const PROJECTS: Project[] = data.projects as Project[];
export const PROJECT_COUNT = PROJECTS.length;
export const INITIAL_INDEX = Math.max(0, PROJECTS.findIndex((p) => p.id === data.initial));

const bySlug = new Map(PROJECTS.map((p) => [p.slug, p]));
export const findProject = (slug: string | undefined) => (slug ? bySlug.get(slug) : undefined);

export const srcSet = (list: ImageSource[]) => list.map((s) => `${s.src} ${s.w}w`).join(', ');
export const largest = (set: ImageSet) => set.sources.webp[set.sources.webp.length - 1].src;
