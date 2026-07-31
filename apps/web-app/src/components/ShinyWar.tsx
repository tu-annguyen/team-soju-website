import { isTeamMember } from '../auth/authorization';
import { useAuthUser } from '../auth/useAuthUser';
import PublicOverview from './shiny-war/PublicOverview';
import ShinyWarOrganizer from './shiny-war/ShinyWarOrganizer';

const ShinyWar = ({ apiBaseUrl }: { apiBaseUrl: string }) => {
  const { authUser, isAuthLoading } = useAuthUser(apiBaseUrl);

  if (!isAuthLoading && isTeamMember(authUser)) {
    return <ShinyWarOrganizer apiBaseUrl={apiBaseUrl} />;
  }

  return <PublicOverview apiBaseUrl={apiBaseUrl} showLoginPrompt={!isAuthLoading && !authUser} />;
}

export default ShinyWar;
