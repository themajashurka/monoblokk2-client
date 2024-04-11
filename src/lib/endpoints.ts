import { getLocationName } from './getLocationName'
import { setShiftState } from './setShiftState'
import { welcome } from './welcome'

export const endpoint = {
  welcome,
  setShiftPresent: setShiftState('Present'),
  setShiftLeft: setShiftState('Left'),
  getLocationName: getLocationName,
}
