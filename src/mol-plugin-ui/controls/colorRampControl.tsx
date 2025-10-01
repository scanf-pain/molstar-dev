import * as React from 'react';
import { Color } from '../../mol-util/color';
import { ParamOnChange } from './parameters';
import { CombinedColorControl } from './color';
import { Button } from './common';

export interface ColorRampControlProps {
    values: { color: Color, offset: number }[];
    isInterpolated: boolean;
    onColorsChanged: ParamOnChange;
    isDisabled?: boolean;
}

interface ColorRampControlState {
    selectedIndex: number | null;
    isDragging: boolean;
    showColorPicker: boolean;
    dragOffset: number;
    svgRect: DOMRect | null;
}

export class ColorRampControl extends React.PureComponent<ColorRampControlProps, ColorRampControlState> {
    private svgRef = React.createRef<SVGSVGElement>();
    private uniqueId: string;

    constructor(props: ColorRampControlProps) {
        super(props);
        this.uniqueId = `color-ramp-${Math.random().toString(36).substr(2, 9)}`;
        this.state = {
            selectedIndex: null,
            isDragging: false,
            showColorPicker: false,
            dragOffset: 0,
            svgRect: null
        };
    }

    componentDidMount() {
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('keydown', this.onKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('keydown', this.onKeyDown);
    }

    updateSvgRect = () => {
        if (this.svgRef.current) {
            this.setState({ svgRect: this.svgRef.current.getBoundingClientRect() });
        }
    };

    onMouseDown = (e: React.MouseEvent, index: number) => {
        if (this.props.isDisabled) return;
        e.preventDefault();
        e.stopPropagation();

        this.updateSvgRect();

        this.setState({
            selectedIndex: index,
            isDragging: true,
            showColorPicker: false
        });
    };

    onMouseMove = (e: MouseEvent) => {
        if (!this.state.isDragging || this.state.selectedIndex === null || !this.state.svgRect) return;

        const relativeX = e.clientX - this.state.svgRect.left;
        const newOffset = Math.max(0, Math.min(1, relativeX / this.state.svgRect.width));

        this.updateControlPoint(this.state.selectedIndex, { offset: newOffset });
    };

    onMouseUp = () => {
        if (this.state.isDragging) {
            this.setState({ isDragging: false });
        }
    };

    onKeyDown = (e: KeyboardEvent) => {
        if (this.state.selectedIndex === null) return;

        if (e.key === 'Delete' && this.canRemovePoint()) {
            this.removeControlPoint(this.state.selectedIndex);
        } else if (e.key === 'Escape') {
            this.setState({ selectedIndex: null, showColorPicker: false });
        }
    };

    onRectDoubleClick = (e: React.MouseEvent) => {
        if (this.props.isDisabled) return;

        this.updateSvgRect();
        if (!this.state.svgRect) return;

        const relativeX = e.clientX - this.state.svgRect.left;
        const offset = Math.max(0, Math.min(1, relativeX / this.state.svgRect.width));

        this.addControlPoint(offset);
    };

    onRectClick = (e: React.MouseEvent) => {
        // Close color picker when clicking on the strip but not on a point
        if (this.state.selectedIndex !== null) {
            this.setState({ selectedIndex: null, showColorPicker: false });
        }
    };

    onPointClick = (e: React.MouseEvent, index: number) => {
        if (this.props.isDisabled) return;
        e.stopPropagation();

        // If clicking the same point, toggle color picker
        if (this.state.selectedIndex === index) {
            this.setState({ showColorPicker: !this.state.showColorPicker });
        } else {
            // Select new point and show color picker
            this.setState({
                selectedIndex: index,
                showColorPicker: true
            });
        }
    };

    addControlPoint = (offset: number) => {
        const { values } = this.props;

        // Find the color to interpolate between adjacent points
        let newColor = Color(0x808080); // Default gray

        for (let i = 0; i < values.length - 1; i++) {
            if (offset >= values[i].offset && offset <= values[i + 1].offset) {
                const t = (offset - values[i].offset) / (values[i + 1].offset - values[i].offset);
                newColor = Color.interpolate(values[i].color, values[i + 1].color, t);
                break;
            }
        }

        const newValues = [...values, { color: newColor, offset }]
            .sort((a, b) => a.offset - b.offset);

        const newIndex = newValues.findIndex(v => v.offset === offset && v.color === newColor);

        this.props.onColorsChanged({
            param: this.props as any,
            name: 'values',
            value: newValues
        });

        this.setState({ selectedIndex: newIndex });
    };

    removeControlPoint = (index: number) => {
        if (!this.canRemovePoint()) return;

        const newValues = this.props.values.filter((_, i) => i !== index);
        this.props.onColorsChanged({
            param: this.props as any,
            name: 'values',
            value: newValues
        });

        this.setState({ selectedIndex: null, showColorPicker: false });
    };

    updateControlPoint = (index: number, updates: Partial<{ color: Color, offset: number }>) => {
        const newValues = [...this.props.values];
        newValues[index] = { ...newValues[index], ...updates };

        // Sort by offset to maintain order
        newValues.sort((a, b) => a.offset - b.offset);

        // Update selected index after sorting
        const updatedPoint = { ...this.props.values[index], ...updates };
        const newIndex = newValues.findIndex(v =>
            v.offset === updatedPoint.offset && v.color === updatedPoint.color
        );

        this.props.onColorsChanged({
            param: this.props as any,
            name: 'values',
            value: newValues
        });

        this.setState({ selectedIndex: newIndex });
    };

    canRemovePoint = (): boolean => {
        return this.props.values.length > 2; // Keep at least 2 points
    };

    onColorChange = (colorData: { value: Color }) => {
        if (this.state.selectedIndex === null) return;
        this.updateControlPoint(this.state.selectedIndex, { color: colorData.value });
    };

    renderGradientStops() {
        const { values, isInterpolated } = this.props;

        if (!isInterpolated) {
            // For non-interpolated, create sharp transitions between colors
            const stops: JSX.Element[] = [];
            for (let i = 0; i < values.length - 1; i++) {
                const currentColor = Color.toHexStyle(values[i].color);
                const currentOffset = (values[i].offset * 100).toFixed(2);
                const nextOffset = (values[i + 1].offset * 100).toFixed(2);

                // Add stop for current color at its position
                stops.push(
                    <stop
                        key={`${i}-start`}
                        offset={`${currentOffset}%`}
                        stopColor={currentColor}
                    />
                );

                // Add stop for current color just before next position (sharp transition)
                stops.push(
                    <stop
                        key={`${i}-end`}
                        offset={`${nextOffset}%`}
                        stopColor={currentColor}
                    />
                );
            }

            // Add final stop for the last color
            const lastColor = Color.toHexStyle(values[values.length - 1].color);
            const lastOffset = (values[values.length - 1].offset * 100).toFixed(2);
            stops.push(
                <stop
                    key="final"
                    offset={`${lastOffset}%`}
                    stopColor={lastColor}
                />
            );

            return stops;
        }

        // For interpolated, create smooth transitions (original behavior)
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
        const { selectedIndex } = this.state;

        return values.map(({ color, offset }, i) => {
            const isSelected = selectedIndex === i;
            const x = offset * 100; // Position in viewBox coordinates (0-100)
            const size = isSelected ? 7 : 6; // Shape size
            const squareHeight = isSelected ? 8 : 6; // Square height
            const triangleHeight = isSelected ? 6 : 5; // Triangle height

            // Square base (bottom part)
            const squareY = 25 + triangleHeight; // Start below the triangle

            // Triangle pointing up to middle of strip (y=15 is middle of strip at y=5-25)
            const trianglePath = `M ${x - size / 2},${25} L ${x + size / 2},${25} L ${x},${15} Z`;

            // Square base path
            const squarePath = `M ${x - size / 2},${25} L ${x + size / 2},${25} L ${x + size / 2},${squareY + squareHeight} L ${x - size / 2},${squareY + squareHeight} Z`;

            return (
                <g key={i}>
                    {/* Square base */}
                    <path
                        d={squarePath}
                        fill={`${Color.toHexStyle(color)}`}
                        stroke="#000"
                        strokeWidth="0.5"
                        onMouseDown={(e) => this.onMouseDown(e, i)}
                        onClick={(e) => this.onPointClick(e, i)}
                        style={{
                            cursor: isDisabled ? 'not-allowed' : 'pointer'
                        }}
                    />
                    {/* Triangle pointing to strip center */}
                    <path
                        d={trianglePath}
                        fill={`${Color.toHexStyle(color)}`}
                        stroke="#000"
                        strokeWidth="0.5"
                        onMouseDown={(e) => this.onMouseDown(e, i)}
                        onClick={(e) => this.onPointClick(e, i)}
                        style={{
                            cursor: isDisabled ? 'not-allowed' : 'pointer'
                        }}
                    />
                    {/* Selection indicator */}
                    {isSelected && (
                        <g>
                            <path
                                d={squarePath}
                                fill="none"
                                stroke="#0066cc"
                                strokeWidth="1"
                                pointerEvents="none"
                            />
                            <path
                                d={trianglePath}
                                fill="none"
                                stroke="#0066cc"
                                strokeWidth="1"
                                pointerEvents="none"
                            />
                        </g>
                    )}
                </g>
            );
        });
    }

    render() {
        const { selectedIndex, showColorPicker } = this.state;
        const { values, isDisabled } = this.props;
        const selectedPoint = selectedIndex !== null ? values[selectedIndex] : null;

        return (
            <div style={{ marginBottom: '8px' }}
                onClick={(e) => {
                    // Only close if clicking the container itself, not child elements
                    if (e.target === e.currentTarget && this.state.selectedIndex !== null) {
                        this.setState({ selectedIndex: null, showColorPicker: false });
                    }
                }}
            >

                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                    Double-click gradient to add points • Click points to select • Drag to move • Delete key to remove
                </div>
                <svg
                    ref={this.svgRef}
                    width="100%"
                    height="50"
                    viewBox="0 0 100 50"
                    preserveAspectRatio="none"
                    style={{ display: 'block', marginBottom: '8px' }}
                >
                    <defs>
                        <linearGradient id={`color-ramp-gradient-${this.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="0%">
                            {this.renderGradientStops()}
                        </linearGradient>
                    </defs>
                    <rect
                        x="0"
                        y="5"
                        width="100"
                        height="20"
                        fill={`url(#color-ramp-gradient-${this.uniqueId})`}
                        onDoubleClick={this.onRectDoubleClick}
                        onClick={this.onRectClick}
                        style={{ cursor: isDisabled ? 'not-allowed' : 'crosshair' }}
                    />
                    {this.renderControlPoints()}
                </svg>

                {/* Color picker */}
                {showColorPicker && selectedPoint && (
                    <div>
                        <CombinedColorControl
                            param={{
                                isExpanded: true,
                                label: 'Point Color'
                            } as any}
                            name="color"
                            value={selectedPoint.color}
                            onChange={this.onColorChange}
                            hideNameRow={true}
                        />

                        <Button
                            onClick={() => selectedIndex !== null && this.removeControlPoint(selectedIndex)}
                            disabled={isDisabled || !this.canRemovePoint()}
                            title="Remove point (Delete key)"
                        >
                                Remove Point
                        </Button>
                    </div>
                )}
            </div>
        );
    }
}