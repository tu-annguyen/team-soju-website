import MemberGate from './MemberGate';
import ShinyWarOrganizer from './shiny-war/ShinyWarOrganizer';

const ShinyWar = ({ apiBaseUrl }: { apiBaseUrl: string }) => {
  return (
    <MemberGate apiBaseUrl={apiBaseUrl}>
      <ShinyWarOrganizer apiBaseUrl={apiBaseUrl} />
    </MemberGate>
  );
}

export default ShinyWar;
