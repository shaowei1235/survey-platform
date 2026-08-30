import { ClientHeader } from "../../components/ClientHeader";

export default function SurveysLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ClientHeader />
      {children}
    </>
  );
}
