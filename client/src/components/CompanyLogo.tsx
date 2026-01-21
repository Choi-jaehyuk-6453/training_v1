import miraeAbmLogo from "@assets/미래ABM_LOGO_1768984011745.png";
import dawonPmcLogo from "@assets/다원PMC_LOGO_1768984013883.png";

interface CompanyLogoProps {
  company: "mirae_abm" | "dawon_pmc" | null | undefined;
  className?: string;
  showName?: boolean;
}

export function CompanyLogo({ company, className = "h-12", showName = false }: CompanyLogoProps) {
  const logoSrc = company === "dawon_pmc" ? dawonPmcLogo : miraeAbmLogo;
  const companyName = company === "dawon_pmc" ? "다원PMC" : "미래에이비엠";

  return (
    <div className="flex items-center gap-3">
      <img 
        src={logoSrc} 
        alt={companyName} 
        className={className}
        style={{ objectFit: "contain" }}
      />
      {showName && (
        <span className="text-lg font-semibold text-foreground">{companyName}</span>
      )}
    </div>
  );
}
