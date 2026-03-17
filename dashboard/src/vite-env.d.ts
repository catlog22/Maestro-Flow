/// <reference types="vite/client" />

declare module 'lucide-react/dist/esm/icons/*.js' {
  import { LucideIconProps } from 'lucide-react';
  const icon: React.FC<LucideIconProps>;
  export default icon;
}
