import { setShiftState } from './setShiftState'
import { welcome } from './welcome'

export const endpoint = {
  setShiftPresent: setShiftState('Present'),
  setShiftLeft: setShiftState('Left'),
  welcome,
}
