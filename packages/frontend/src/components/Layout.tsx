import { ReactNode } from "react";
import { Header } from "./Header";

export const Layout = ({ children }: { children?: ReactNode }) => {
  return (
    <div>
      <Header />
      <div>{children}</div>
    </div>
  );
};
