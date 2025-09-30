import * as React from 'react';
import { Color } from '../../mol-util/color';
import { ParamOnChange } from './parameters';

export interface ColorRampControlProps {
    values: { color: Color, offset: number }[];
    isInterpolated: boolean;
    onColorsChanged: ParamOnChange;
    isDisabled?: boolean;
}

export class ColorRampControl extends React.PureComponent<ColorRampControlProps> {
    onMouseDown = (e: React.MouseEvent, index: number) => {
        if (this.props.isDisabled) return;
        // Add dragging logic later here.
        e.preventDefault();
        console.log(this.props.values);
    };

    renderGradientStops() {
        const { values } = this.props;
        return values.map(({ color, offset }, i) => (
            <stop
                key={i}
                offset={`${(offset * 100).toFixed(2)}%`}
                stopColor={`${Color.toHexStyle(color)}`}
            />
        ));
    }

    renderControlPoints() {
        const { values, isDisabled } = this.props;
        return values.map(({ color, offset }, i) => (
            <circle
                key={i}
                cx={`${(offset * 100).toFixed(2)}%`}
                cy="15"
                r={6}
                fill={`${Color.toHexStyle(color)}`}
                stroke="#000"
                strokeWidth={1}
                onMouseDown={(e) => this.onMouseDown(e, i)}
                style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
            />
        ));
    }

    render() {
        return (
            <svg width="100%" height="30" style={{ display: 'block', marginBottom: '8px' }}>
                <defs>
                    <linearGradient id="color-ramp-gradient" x1="0%" y1="0%" x2="100%" y2="0%" >
                        {this.renderGradientStops()}
                    </linearGradient>
                </defs>
                <rect x="0" y="5" width="100%" height="10" fill="url(#color-ramp-gradient)" />
                {this.renderControlPoints()}
            </svg>
        );
    }
}