/**
 * @stoneforge/ui Contexts
 *
 * Shared React contexts for Stoneforge platform.
 */

export {
  CurrentUserProvider,
  useCurrentUser,
  type CurrentUserContextValue,
  type CurrentUserProviderProps,
  type UserEntity,
} from './CurrentUserContext';

export {
  ProjectProvider,
  useProject,
  type ProjectContextValue,
  type ProjectProviderProps,
} from './ProjectContext';
