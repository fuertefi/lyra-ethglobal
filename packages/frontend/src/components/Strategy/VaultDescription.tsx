import styled from "styled-components";

type VaultDescriptionProps = {
  link?: string;
  children: React.ReactNode;
  className?: string;
};

const Header = styled.header`
  font-weight: 700;
  font-family: "Satoshi";
  margin-bottom: 8px;
  margin-top: 50px;
`;

const VaultDescription = ({
  children,
  link,
  className,
}: VaultDescriptionProps) => (
  <div className={className}>
    <Header>Vault Strategy</Header>
    {children}
  </div>
);

export default VaultDescription;
