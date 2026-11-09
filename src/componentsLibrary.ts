export const allComponents = "All Components";
const prefix = "Components / ";
export const componentInbox = prefix + "Uncategorised";

export const componentGroups: Record<string, string[]> = {
  "Site parts": ["Navbars", "Mega menus", "Headers", "Footers", "Banners", "404 pages", "Dashboard", "Templates"],
  "Page sections": ["Features", "Calls to action", "Stats", "Testimonials", "Pricing", "FAQs", "Contact", "Teams", "Careers", "Logo grids"],
  "Content & media": ["Image boxes", "Icon boxes", "Text blocks", "Galleries", "Videos", "Steps", "Timelines"],
  "Interactive": ["Buttons", "Sliders", "Tabs", "Accordions"],
  "Forms": ["Signups", "Logins", "Email opt-ins"],
  "Blog & portfolio": ["Blog sections", "Single posts", "Blog archives", "Portfolio headers", "Portfolio sections"],
  "Shop": ["Products", "Product grids", "Cart & checkout"],
};

export const componentKey = (folder: string) => prefix + folder;
export const isComponent = (name: string) => name.startsWith(prefix);
export const componentFolders = [componentInbox, ...Object.values(componentGroups).flat().map(componentKey)];
export const isWebDesign = (name: string) => /^web[\s_-]*design$/i.test(name.trim());
export const isHeaderFolder = (name:string) => /^Components \/ (Heroes|Hero|Headers|Header)$/.test(name);
export const filingCategory = (name: string) => name === allComponents || isWebDesign(name) ? componentInbox : isHeaderFolder(name) ? componentKey("Headers") : name;
