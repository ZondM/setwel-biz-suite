"""Pre-registered timeframe variants (docs/06, docs/08 = base; docs/10 = h1)."""
import pandas as pd

from .patterns.retest import RetestParams
from .sim.trades import ExitParams

VARIANTS = {
    "base": dict(setup="M15", confirm="M5", mid="H1", top="H4", protocol_a="docs/06", protocol_b="docs/08",
                 retest=RetestParams(), exit=ExitParams()),
    "h1": dict(setup="H1", confirm="M15", mid="H4", top="D1", protocol_a="docs/10", protocol_b="docs/10",
               retest=RetestParams(expiry=pd.Timedelta(hours=24)), exit=ExitParams(max_hold=pd.Timedelta(hours=96))),
}
